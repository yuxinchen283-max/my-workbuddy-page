# 更新日志 - game-v6-debug.html

## 版本: v6-debug (调试版)
## 日期: 2025-01-09

---

## 修复的 Bug

### Bug #1: 方向控制限制问题
**症状**: 挥手无法启动游戏
**位置**: `processLandmarks()` 函数
**原因**: 只在 `state.nearIntersection` 为 true 时才设置 `rawDir`
**修复**:
```javascript
// 修复前
if (state.nearIntersection) {
  state.action.horizontalIntent = rawDir;
}

// 修复后
state.action.horizontalIntent = rawDir;  // 始终更新
```
**影响**: 挥手现在可以启动游戏

---

### Bug #2: 体感输入优先级问题
**症状**: 体感输入被键盘/鼠标覆盖
**位置**: `Input.update()` 函数
**原因**: 先检查键盘和鼠标，体感优先级最低
**修复**:
```javascript
// 修复前：优先级 键盘 > 鼠标 > 体感
if (ki || kb || kbr || kp) { ... }
else if (this.pointerDown) { ... }
else if (ca) { ... }

// 修复后：优先级 体感 > 键盘 > 鼠标
if (ca) { ... }
else if (ki || kb || kbr || kp) { ... }
else if (this.pointerDown) { ... }
```
**影响**: 体感输入现在可以正确覆盖键盘和鼠标

---

### Bug #3: 手腕位置更新顺序错误（关键Bug）
**症状**: 所有基于速度的检测都失败（速度始终为0）
**位置**: `processLandmarks()` 函数第494-520行
**原因**: 先更新 `prevLeftWrist`，再调用 `detectWave()`，导致速度为0
**修复**:
```javascript
// ❌ 修复前：先更新，再检测（速度为0）
if (lw && lw.score > 0.3) {
  prevLeftWrist = { x: lw.x, y: lw.y };  // 覆盖了上一帧
  prevLeftWristTime = now;
}
const waves = detectWave(landmarks, now);  // 此时 prevLeftWrist 已是当前帧

// ✅ 修复后：先检测，再更新
const waves = detectWave(landmarks, now);  // 使用真实的上一帧数据
if (lw && lw.score > 0.3) {
  prevLeftWrist = { x: lw.x, y: lw.y };  // 检测完再更新
  prevLeftWristTime = now;
}
```
**影响**: 所有基于速度的检测现在都能正确工作

---

### Bug #4: 手势检测阈值过高
**症状**: 需要很大的动作才能触发手势
**位置**: `PARAMS` 对象（第145-148行）
**原因**: 阈值设置太高，正常动作检测不到
**修复**:
```javascript
// 修复前
waveVelocityThreshold: 0.3,
waveUpVelocityThreshold: 0.4,
fistDistanceThreshold: 0.15

// 修复后（v1）
waveVelocityThreshold: 0.1,
waveUpVelocityThreshold: 0.1,
fistDistanceThreshold: 0.2

// 修复后（v2 - 当前）
waveVelocityThreshold: 0.05,   // 再降低
waveUpVelocityThreshold: 0.08,  // 再降低
fistDistanceThreshold: 0.25     // 再提高
```
**影响**: 手势更容易被检测到

---

### Bug #5: 握拳刹车逻辑错误
**症状**: 握拳不能持续刹车，而是切换状态
**位置**: `Input.update()` 函数第1059-1065行
**原因**: 使用上升沿检测切换 `stopped` 状态，但游戏需要持续刹车
**修复**:
```javascript
// ❌ 修复前：切换状态
if (ca.action.brakeTrigger && !this.prevBrakeTrigger) {
  this.stopped = !this.stopped;  // 切换，不是持续
}

// ✅ 修复后：持续检测
const fist = ca.action.brakeHold || ca.action.brakeTrigger;
this.brakeHold = fist;
this.stopped = fist;  // 握拳时停止，松拳时恢复
```
**影响**: 握拳时持续刹车，松拳时恢复

---

### Bug #6: logCounter 更新时机错误
**症状**: 调试日志输出不正确
**位置**: `processLandmarks()` 和 `frameLoop()` 函数
**原因**: `logCounter` 在 `frameLoop()` 中递增，而不是在 `processLandmarks()` 中
**修复**:
```javascript
// ✅ 在 processLandmarks() 开头递增
function processLandmarks(landmarks) {
  const now = performance.now();
  logCounter++;  // 在每一帧处理开始时递增
  ...
}
```
**影响**: 调试日志现在能正确输出

---

## 新增功能

### 1. 视频小窗实时手势显示
**位置**: `drawSkeleton()` 函数
**功能**: 在视频小窗上显示检测到的手势方向
- ◀ 左挥（检测到左手向左挥）
- 右挥 ▶（检测到右手向右挥）
- ▲ 上挥（检测到向上挥手）
- ✊ 握拳刹车（检测到握拳）

**代码**:
```javascript
// 向左挥手 → 左侧显示左箭头
if (waves && waves.leftWave) {
  skctx.font = 'bold 28px sans-serif';
  skctx.fillStyle = '#ff5252';
  skctx.textAlign = 'left';
  skctx.fillText('◀ 左挥', 10, h - 60);
}
// 向右挥手、向上挥手、握拳类似...
```

---

### 2. 详细的控制台日志
**位置**: `detectWave()` 函数
**功能**: 输出手腕速度、方向、阈值比较
**触发条件**:
- 每10帧输出一次
- 或速度超过阈值的一半时输出
- 或检测到手势时输出

**示例输出**:
```
[detectWave] 左手速度: velX=-0.123, velY=0.045, threshold=0.05
[detectWave] 左手 X 方向: 向左 (velX=-0.123, threshold=0.05)
[detectWave] 检测到左手向左挥！velX= -0.123
```

---

### 3. 调试面板更新
**位置**: `updateCameraDataPanel()` 函数
**功能**: 实时显示体感输入数据
- 摄像头状态
- MoveNet 状态
- 置信度
- 手部坐标和速度
- 手势检测结果
- 动作意图

---

### 4. 骨骼详情表格
**位置**: `updateSkeletonDetail()` 函数
**功能**: 显示所有17个骨骼点的坐标和置信度
**触发**: 点击"显示骨骼详情"按钮

---

## 参数调整

### 当前参数（v6-debug）
```javascript
const PARAMS = {
  waveVelocityThreshold: 0.05,   // 左右挥手速度阈值
  waveUpVelocityThreshold: 0.08,  // 向上挥手速度阈值
  fistDistanceThreshold: 0.25,     // 握拳距离阈值
};
```

### 调整建议
- **检测不到手势** → 降低 `waveVelocityThreshold` 和 `waveUpVelocityThreshold`
- **误触发太多** → 提高 `waveVelocityThreshold` 和 `waveUpVelocityThreshold`
- **握拳检测不到** → 提高 `fistDistanceThreshold`
- **误触发握拳** → 降低 `fistDistanceThreshold`

---

## 测试步骤

### 1. 打开文件
在浏览器中打开 `game-v6-debug.html`

### 2. 开启摄像头
点击"📷 摄像头"按钮，允许浏览器访问摄像头

### 3. 打开控制台
按 `F12` 打开开发者工具，切换到"控制台"标签

### 4. 测试手势
| 手势 | 预期结果 |
|------|----------|
| 向左挥左手 | 视频小窗显示 "◀ 左挥"，控制台输出日志，游戏角色左转 |
| 向右挥右手 | 视频小窗显示 "右挥 ▶"，控制台输出日志，游戏角色右转 |
| 向上挥手 | 视频小窗显示 "▲ 上挥"，控制台输出日志，游戏角色加速 |
| 握拳 | 视频小窗显示 "✊ 握拳刹车"，控制台输出日志，游戏角色刹车 |

---

## 如果还是检测不到

### 可能的原因和解决方案

#### 1. 方向反了
**症状**: 向左挥手，但检测到的是"右挥"

**解决方案**: 修改 `detectWave()` 中的方向判断
```javascript
// 将 < 改为 >，或将 > 改为 <
if (velX > PARAMS.waveVelocityThreshold) {  // 原来的是 <
  leftWave = true;
}
```

#### 2. 阈值还是太高
**症状**: 控制台显示速度值，但不触发手势

**解决方案**: 进一步降低阈值
```javascript
waveVelocityThreshold: 0.02,  // 从 0.05 降低
```

#### 3. 速度计算错误
**症状**: 速度值始终为 0 或很小

**解决方案**: 检查 `prevLeftWrist` 和 `prevRightWrist` 的更新时机
- 确保在 `detectWave()` **之后**才更新
- 检查 `dt` 是否在合理范围内（0.01 到 0.5 之间）

#### 4. flipHorizontal 参数错误
**症状**: 所有方向都反了

**解决方案**: 修改 `estimatePoses()` 的参数
```javascript
const poses = await detector.estimatePoses(video, { flipHorizontal: false });  // 改为 false
```

---

## 文件对比

| 文件 | 说明 |
|------|------|
| `game-v6.html` | 原始文件（有问题） |
| `game-v6-debug.html` | 调试版本（当前使用，包含详细日志和可视化） |

测试成功后，可以将调试代码清理掉，移植到 `game-v6.html` 中。

---

## 下一步

1. **测试所有手势**，确认是否能正确检测
2. **查看控制台日志**，确认速度计算是否正确
3. **调整参数**，根据实际效果微调阈值
4. **清理调试代码**，测试成功后移除日志和可视化代码
5. **移植到正式版**，将修复后的代码移植到 `game-v6.html`

---

## 已知问题

1. **方向可能还是反的** - 如果 `flipHorizontal: true` 的坐标镜像和数据面板显示的逻辑不匹配，可能需要调整方向判断
2. **阈值可能需要个性化** - 不同人的动作幅度不同，可能需要根据个人情况调整阈值
3. **光照影响** - 光照不足可能影响 MoveNet 的检测效果

---

## 贡献者

- **调试**: WorkBuddy AI
- **日期**: 2025-01-09
- **版本**: v6-debug
