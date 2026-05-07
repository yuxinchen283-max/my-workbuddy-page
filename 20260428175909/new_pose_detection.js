完整重写后的姿态检测代码 - 替换 game-v5.html 第177-914行

=============================================
替换目标：第177行的 `(function(){` 到第914行的 `})();`
=============================================

(function(){
  // ---- 基础变量 ----
  let video = null, sk = null, skctx = null;
  let stream = null;
  let frameLoopId = null;
  let detector = null;
  let detectorReady = false;
  let modelLoading = false;

  // ---- MoveNet 关键点定义 (17点) ----
  const KP = {
    NOSE: 0,
    LEFTEYE: 1, RIGHTEYE: 2,
    LEFTEAR: 3, RIGHTEAR: 4,
    LEFTSHOULDER: 5, RIGHTSHOULDER: 6,
    LEFELBOW: 7, RIGHTELBOW: 8,
    LEFTWRIST: 9, RIGHTWRIST: 10,
    LEFTHIP: 11, RIGHTHIP: 12,
    LEFTKNEE: 13, RIGHTKNEE: 14,
    LEFTANKLE: 15, RIGHTANKLE: 16
  };

  // ---- 骨骼连接定义 ----
  const BONES = [
    [5, 7], [7, 9],    // 左臂
    [6, 8], [8, 10],   // 右臂
    [5, 6],              // 肩膀
    [5, 11], [6, 12],  // 肩膀到髋部
    [11, 12],            // 髋部
    [11, 13], [13, 15], // 左腿
    [12, 14], [14, 16]  // 右腿
  ];

  // ---- 状态 ----
  const state = {
    enabled: false,
    ready: false,
    hasCamera: false,
    confidence: 0,
    bodyCenter: { x: 0.5, y: 0.5 },
    action: {
      horizontalIntent: 0,
      forwardBoostIntent: false,
      brakeHold: false,
      paintActive: false,
      waveUpTrigger: false,
      brakeTrigger: false
    },
    raw: { motionAmount: 0, leftHandUp: false, rightHandUp: false },
    nearIntersection: false,
    turnHint: ''
  };

  // ---- 手势检测历史 ----
  let prevLeftWrist = null, prevRightWrist = null;
  let prevLeftWristTime = 0, prevRightWristTime = 0;
  let lastWaveTime = 0;
  const WAVESUSTAINMS = 600;
  const DIRCOOLDOWNMS = 500;

  // ---- 日志计数器 ----
  let logCounter = 0;

  // ============================================================
  // 初始化 MoveNet 检测器
  // ============================================================
  async function initDetector() {
    if (detector || modelLoading) return;
    modelLoading = true;

    try {
      console.log('[MoveNet v6] 开始加载...');
      await tf.ready();

      const model = poseDetection.SupportedModels.MoveNet;
      const config = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSELIGHTNING,
        enableSmoothing: true,
        minPoseScore: 0.15
      };

      detector = await poseDetection.createDetector(model, config);
      detectorReady = true;
      modelLoading = false;
      console.log('[MoveNet v6] 加载成功！');
    } catch (e) {
      console.error('[MoveNet v6] 加载失败:', e);
      modelLoading = false;
      detectorReady = false;
    }
  }

  // ============================================================
  // 计算置信度
  // ============================================================
  function calcConfidence(landmarks) {
    if (!landmarks || !landmarks.length) return 0;

    // 检查关键骨骼点（肩膀、肘、腕）
    const keyIndices = [KP.LEFTSHOULDER, KP.RIGHTSHOULDER, KP.LEFTELBOW, KP.RIGHTELBOW, KP.LEFTWRIST, KP.RIGHTWRIST];
    let validCount = 0;
    keyIndices.forEach(i => {
      if (landmarks[i] && landmarks[i].score > 0.3) validCount++;
    });

    return validCount / keyIndices.length;
  }

  // ============================================================
  // 判断手是否上举（手腕高于肩膀）
  // ============================================================
  function checkHandUp(landmarks) {
    const ls = landmarks[KP.LEFTSHOULDER];
    const rs = landmarks[KP.RIGHTSHOULDER];
    const lw = landmarks[KP.LEFTWRIST];
    const rw = landmarks[KP.RIGHTWRIST];

    let leftUp = false, rightUp = false;

    if (ls && lw && ls.score > 0.3 && lw.score > 0.3) {
      leftUp = lw.y < ls.y - 0.05;  // 手腕比肩膀高 5% 以上
    }
    if (rs && rw && rs.score > 0.3 && rw.score > 0.3) {
      rightUp = rw.y < rs.y - 0.05;
    }

    return { leftUp, rightUp };
  }

  // ============================================================
  // 检测握拳（手腕靠近肘部）
  // ============================================================
  function checkFist(landmarks) {
    const le = landmarks[KP.LEFTELBOW];
    const lw = landmarks[KP.LEFTWRIST];
    const re = landmarks[KP.RIGHTELBOW];
    const rw = landmarks[KP.RIGHTWRIST];

    let leftFist = false, rightFist = false;

    if (le && lw && le.score > 0.3 && lw.score > 0.3) {
      const dist = Math.hypot(lw.x - le.x, lw.y - le.y);
      leftFist = dist < 0.12;
    }
    if (re && rw && re.score > 0.3 && rw.score > 0.3) {
      const dist = Math.hypot(rw.x - re.x, rw.y - re.y);
      rightFist = dist < 0.12;
    }

    return leftFist || rightFist;
  }

  // ============================================================
  // 检测挥手动作（基于速度）
  // ============================================================
  function detectWave(landmarks, now) {
    const lw = landmarks[KP.LEFTWRIST];
    const rw = landmarks[KP.RIGHTWRIST];

    let leftWave = false, rightWave = false;
    let leftUpWave = false, rightUpWave = false;

    // 计算左手速度
    if (prevLeftWrist && lw && lw.score > 0.3) {
      const dt = (now - prevLeftWristTime) / 1000;
      if (dt > 0.01 && dt < 0.5) {
        const velX = (lw.x - prevLeftWrist.x) / dt;
        const velY = (lw.y - prevLeftWrist.y) / dt;

        // 向左挥手：速度 < -0.5
        if (velX < -0.5 && Math.abs(velY) < 0.4) leftWave = true;

        // 向上挥手：速度 < -0.4
        if (velY < -0.4) leftUpWave = true;
      }
    }

    // 计算右手速度
    if (prevRightWrist && rw && rw.score > 0.3) {
      const dt = (now - prevRightWristTime) / 1000;
      if (dt > 0.01 && dt < 0.5) {
        const velX = (rw.x - prevRightWrist.x) / dt;
        const velY = (rw.y - prevRightWrist.y) / dt;

        // 向右挥手：速度 > 0.5
        if (velX > 0.5 && Math.abs(velY) < 0.4) rightWave = true;

        // 向上挥手：速度 < -0.4
        if (velY < -0.4) rightUpWave = true;
      }
    }

    return { leftWave, rightWave, leftUpWave, rightUpWave };
  }

  // ============================================================
  // 检查是否接近路口
  // ============================================================
  function checkNearIntersection() {
    try {
      const p = Game ? Game.player : null;
      if (!p || !p.currentSegment) return false;

      const seg = p.currentSegment;
      const nA = gridNodes[seg.fromNode];
      const nB = gridNodes[seg.toNode];
      const len = Math.hypot(nB.x - nA.x, nB.z - nA.z);

      const distToEnd = p.segDir > 0 ? (1 - p.segT) * len : p.segT * len;
      return distToEnd < 6.0;  // TURNAHEADDISTANCE
    } catch(e) {
      return false;
    }
  }

  // ============================================================
  // 处理骨骼数据（主逻辑）
  // ============================================================
  function processLandmarks(landmarks) {
    if (!landmarks || !landmarks.length) {
      state.confidence = 0;
      return;
    }

    const now = performance.now();

    // 计算置信度
    state.confidence = calcConfidence(landmarks);

    // 计算身体中心
    let cx = 0, cy = 0, cnt = 0;
    [KP.LEFTSHOULDER, KP.RIGHTSHOULDER].forEach(i => {
      if (landmarks[i] && landmarks[i].score > 0.3) {
        cx += landmarks[i].x;
        cy += landmarks[i].y;
        cnt++;
      }
    });
    if (cnt > 0) {
      state.bodyCenter = { x: cx / cnt, y: cy / cnt };
    }

    // 更新手腕历史位置
    const lw = landmarks[KP.LEFTWRIST];
    const rw = landmarks[KP.RIGHTWRIST];
    if (lw && lw.score > 0.3) {
      prevLeftWrist = { x: lw.x, y: lw.y };
      prevLeftWristTime = now;
    }
    if (rw && rw.score > 0.3) {
      prevRightWrist = { x: rw.x, y: rw.y };
      prevRightWristTime = now;
    }

    // 检测挥手
    const waves = detectWave(landmarks, now);

    // 检测手是否上举
    const handUp = checkHandUp(landmarks);
    state.raw.leftHandUp = handUp.leftUp;
    state.raw.rightHandUp = handUp.rightUp;

    // 检测握拳
    const fist = checkFist(landmarks);
    state.action.brakeHold = fist;

    // 方向控制（接近路口时才生效）
    state.nearIntersection = checkNearIntersection();

    let rawDir = 0;
    if (waves.leftWave) {
      rawDir = -1;
      state.turnHint = 'left';
      console.log('[MoveNet v6] 检测到向左挥手！');
    } else if (waves.rightWave) {
      rawDir = 1;
      state.turnHint = 'right';
      console.log('[MoveNet v6] 检测到向右挥手！');
    } else {
      state.turnHint = '';
    }

    if (state.nearIntersection || rawDir !== 0) {
      state.action.horizontalIntent = rawDir;
    } else {
      state.action.horizontalIntent = 0;
    }

    // 向上挥手触发加速
    const upWave = waves.leftUpWave || waves.rightUpWave;
    if (upWave) {
      state.action.waveUpTrigger = true;
      lastWaveTime = now;
      state.action.forwardBoostIntent = true;
      console.log('[MoveNet v6] 向上挥手 - 加速！');
    } else {
      state.action.waveUpTrigger = false;
      // 加速持续一段时间
      state.action.forwardBoostIntent = (now - lastWaveTime) < WAVESUSTAINMS;
    }

    // 握拳触发
    state.action.brakeTrigger = fist;

    // 调试日志
    if (logCounter % 30 === 0) {
      console.log('[骨骼]',
        '| 置信:', (state.confidence * 100).toFixed(0) + '%',
        '| 左手:', lw && lw.score > 0.3 ? `(${lw.x.toFixed(2)}, ${lw.y.toFixed(2)})` : '未检测',
        '| 右手:', rw && rw.score > 0.3 ? `(${rw.x.toFixed(2)}, ${rw.y.toFixed(2)})` : '未检测',
        '| 方向:', state.action.horizontalIntent,
        '| 加速:', state.action.forwardBoostIntent ? '是' : '否',
        '| 刹车:', state.action.brakeHold ? '是' : '否'
      );
    }
  }

  // ============================================================
  // 绘制小窗骨骼
  // ============================================================
  function drawSkeleton(landmarks, confidence) {
    if (!skctx) return;

    const w = 240, h = 180;

    // 深色背景
    skctx.fillStyle = '#1a1d24';
    skctx.fillRect(0, 0, w, h);

    // 绘制摄像头画面（镜像）
    if (video && video.readyState >= 2) {
      skctx.save();
      skctx.translate(w, 0);
      skctx.scale(-1, 1);
      skctx.drawImage(video, 0, 0, w, h);
      skctx.restore();
    }

    // 画布边框
    const isGood = confidence > 0.35;
    skctx.strokeStyle = isGood ? 'rgba(0, 255, 136, 0.6)' : 'rgba(255, 68, 68, 0.5)';
    skctx.lineWidth = 2;
    skctx.strokeRect(1, 1, w - 2, h - 2);

    if (!landmarks || !landmarks.length) {
      // 等待检测
      skctx.fillStyle = isGood ? '#00ff88' : '#ff4444';
      skctx.font = 'bold 11px sans-serif';
      skctx.textAlign = 'center';
      skctx.fillText('等待人体检测...', w/2, 50);
      skctx.fillStyle = '#888';
      skctx.font = '10px sans-serif';
      skctx.fillText('请站到摄像头前', w/2, 66);
    } else {
      // 绘制骨骼
      const scaleX = (x) => (1 - x) * w;
      const scaleY = (y) => y * h;

      skctx.strokeStyle = isGood ? '#00ff88' : '#ff4444';
      skctx.fillStyle = isGood ? '#00ff88' : '#ff4444';
      skctx.lineWidth = 2;

      // 连接线
      BONES.forEach(([a, b]) => {
        const la = landmarks[a], lb = landmarks[b];
        if (la && lb && la.score > 0.3 && lb.score > 0.3) {
          skctx.beginPath();
          skctx.moveTo(scaleX(la.x), scaleY(la.y));
          skctx.lineTo(scaleX(lb.x), scaleY(lb.y));
          skctx.stroke();
        }
      });

      // 关节点
      for (let i = 0; i <= 16; i++) {
        const p = landmarks[i];
        if (!p || p.score < 0.3) continue;
        skctx.beginPath();
        skctx.arc(scaleX(p.x), scaleY(p.y), i === KP.NOSE ? 5 : 3, 0, Math.PI * 2);
        skctx.fill();
      }

      // 手腕特殊标记
      [KP.LEFTWRIST, KP.RIGHTWRIST].forEach(i => {
        const p = landmarks[i];
        if (!p || p.score < 0.3) return;
        const isUp = (i === KP.LEFTWRIST && state.raw.leftHandUp) ||
                     (i === KP.RIGHTWRIST && state.raw.rightHandUp);
        skctx.fillStyle = isUp ? '#ffeb3b' : '#fff176';
        skctx.beginPath();
        skctx.arc(scaleX(p.x), scaleY(p.y), 4, 0, Math.PI * 2);
        skctx.fill();
      });

      // 方向指示
      if (state.action.horizontalIntent !== 0) {
        skctx.font = 'bold 16px sans-serif';
        skctx.fillStyle = state.action.horizontalIntent < 0 ? '#ff5252' : '#36a3ff';
        skctx.fillText(state.action.horizontalIntent < 0 ? '◀' : '▶', 210, 25);
      }

      // 路口提示
      if (state.nearIntersection) {
        skctx.font = 'bold 11px sans-serif';
        skctx.fillStyle = '#ff9800';
        skctx.fillText('接近路口!', 6, 26);
      }
    }

    // 状态标签
    skctx.font = 'bold 12px sans-serif';
    skctx.textAlign = 'left';
    skctx.fillStyle = isGood ? '#00ff88' : '#ff4444';
    skctx.fillText(isGood ? '✓ 骨骼追踪' : '✗ 等待检测', 10, 20);

    // 置信度条
    skctx.fillStyle = 'rgba(255,255,255,0.3)';
    skctx.fillRect(10, 28, 60, 4);
    skctx.fillStyle = isGood ? '#00ff88' : '#ff4444';
    skctx.fillRect(10, 28, 60 * Math.max(0, confidence), 4);

    // 实时数据
    skctx.fillStyle = '#fff';
    skctx.font = '9px monospace';

    const lw = landmarks ? landmarks[KP.LEFTWRIST] : null;
    const rw = landmarks ? landmarks[KP.RIGHTWRIST] : null;

    skctx.fillText('LW: ' + (lw && lw.score > 0.3 ? `${lw.x.toFixed(2)}, ${lw.y.toFixed(2)}` : '---'), 6, 170);
    skctx.fillText('RW: ' + (rw && rw.score > 0.3 ? `${rw.x.toFixed(2)}, ${rw.y.toFixed(2)}` : '---'), 6, 160);
    skctx.fillText('CONF: ' + (confidence * 100).toFixed(0) + '%', 6, 150);
  }

  // ============================================================
  // 帧循环
  // ============================================================
  async function frameLoop() {
    if (!state.enabled) return;

    if (!video || video.readyState < 2) {
      frameLoopId = requestAnimationFrame(frameLoop);
      return;
    }

    if (detector && detectorReady) {
      try {
        const poses = await detector.estimatePoses(video, { flipHorizontal: true });
        if (poses && poses.length > 0) {
          const landmarks = poses[0].keypoints;
          if (landmarks && landmarks.length > 0) {
            processLandmarks(landmarks);
            drawSkeleton(landmarks, state.confidence);
            logCounter++;
          } else {
            drawSkeleton(null, 0);
          }
        } else {
          drawSkeleton(null, 0);
        }
      } catch (e) {
        console.warn('[MoveNet v6] 检测错误:', e.message);
      }
    } else {
      drawSkeleton(null, 0);
    }

    logCounter++;
    frameLoopId = requestAnimationFrame(frameLoop);
  }

  // ============================================================
  // 启动摄像头
  // ============================================================
  async function start() {
    video = document.getElementById('cameraVideo');
    sk = document.getElementById('skeletonCanvas');
    skctx = sk.getContext('2d');
    sk.style.display = 'block';

    console.log('[Camera v6] 启动摄像头...');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('[Camera v6] 不支持 getUserMedia');
      return false;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });

      video.srcObject = stream;
      video.style.display = 'block';
      sk.style.display = 'block';

      await new Promise((resolve) => {
        if (video.readyState >= 2) resolve();
        else {
          video.onloadedmetadata = resolve;
          setTimeout(resolve, 3000);
        }
      });
      await video.play();

      console.log('[Camera v6] 视频已就绪');

      // 初始化检测器
      await initDetector();

      state.enabled = state.ready = state.hasCamera = true;
      frameLoop();

      if (detectorReady) {
        showCenterMessage("MoveNet 骨骼追踪已开启!", 2000);
      } else {
        showCenterMessage("摄像头已开启（MoveNet加载中...）", 2000);
      }

      setInputModeUI("体感+键鼠");
      return true;

    } catch (e) {
      console.error('[Camera v6] 启动失败:', e);
      state.enabled = state.ready = state.hasCamera = false;
      setInputModeUI("键鼠/触摸");
      showCenterMessage("摄像头不可用，已切换键鼠模式", 1800);
      return false;
    }
  }

  // ============================================================
  // 停止摄像头
  // ============================================================
  function stop() {
    if (frameLoopId) {
      cancelAnimationFrame(frameLoopId);
      frameLoopId = null;
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (video) {
      video.pause();
      video.srcObject = null;
      video.style.display = 'none';
    }
    if (sk) sk.style.display = 'none';

    state.enabled = state.ready = state.hasCamera = false;
    state.confidence = 0;
    prevLeftWrist = null;
    prevRightWrist = null;

    setInputModeUI("键鼠/触摸");
  }

  // ============================================================
  // 获取状态
  // ============================================================
  function tick() {
    return state;
  }

  function getState() {
    return {
      ...state,
      turnHint: state.turnHint,
      nearIntersection: state.nearIntersection
    };
  }

  // 导出
  window.LocalCameraRecognizer = { start, stop, tick, getState };

  console.log('[Camera v6] 姿态检测模块已加载');
})();
