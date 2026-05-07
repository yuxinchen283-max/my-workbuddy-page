# 体感输入调试指南 - game-v6-debug.html

## 已修复的问题

### ✅ Bug #1: 方向控制限制问题
- **位置**: `processLandmarks()` 函数
- **修复**: 始终更新 `state.action.horizontalIntent`，不再限制在接近路口时
- **影响**: 挥手现在可以启动游戏

### ✅ Bug #2: 体感输入优先级问题
- **位置**: `Input.update()` 函数
- **修复**: 将体感输入优先级提到最高
- **影响**: 体感输入现在可以正确覆盖键盘和鼠标输入

### ✅ Bug #3: 手腕位置更新顺序错误（关键Bug）
- **位置**: `processLandmarks()` 函数第517-538行
- **修复**: 先调用 `detectWave()`，再更新 `prevLeftWrist` 和 `prevRightWrist`
- **影响**: 所有基于速度的检测现在都能正确工作

### ✅ Bug #4: 手势检测阈值过高
- **修复**: 
  - `waveVelocityThreshold: 0.05`（从 0.3 降低到 0.05）
  - `waveUpVelocityThreshold: 0.08`（从 0.4 降低到 0.08）
  - `fistDistanceThreshold: 0.25`（从 0.15 提高到 0.25）
- **影响**: 手势更容易被检测到

### ✅ Bug #5: 握拳刹车逻辑错误
- **位置**: `Input.update()` 函数
- **修复**: 
  - 从"切换状态"改为"持续检测"
  - 握拳时：`this.brakeHold = true; this.stopped = true;`
  - 松拳时：`this.brakeHold = false; this.stopped = false;`
- **影响**: 握拳时持续刹车，松拳时恢复

### ✅ Bug #6: logCounter 更新时机错误
- **位置**: `processLandmarks()` 函数
- **修复**: 在每一帧处理开始时递增 `logCounter`
- **影响**: 调试日志现在能正确输出

## 新增的调试功能

### 1. 视频小窗实时手势显示
在视频小窗上会显示：
- ◀ 左挥（检测到左手向左挥）
- 右挥 ▶（检测到右手向右挥）
- ▲ 上挥（检测到向上挥手）
- ✊ 握拳刹车（检测到握拳）

### 2. 详细的控制台日志
- 每一帧都会输出手腕速度
- 当速度接近阈值时，会输出方向信息
- 格式：`[detectWave] 左手 X 方向: 向左 (velX=-0.123, threshold=0.05)`

### 3. 调试面板
右侧的"体感数据面板"会显示：
- 左手/右手坐标
- 左手/右手速度
- 手势检测结果（左挥、右挥、上挥、握拳）
- 动作意图（方向、加速、刹车）

### 4. 骨骼详情表格
点击"显示骨骼详情"按钮，会显示所有17个骨骼点的坐标和置信度。

## 如何测试

### 步骤1: 打开文件
在浏览器中打开 `game-v6-debug.html`

### 步骤2: 开启摄像头
点击"📷 摄像头"按钮，允许浏览器访问摄像头

### 步骤3: 打开控制台
按 `F12` 打开开发者工具，切换到"控制台"标签

### 步骤4: 测试手势
1. **向左挥左手** → 观察：
   - 视频小窗是否显示 "◀ 左挥"
   - 控制台是否输出 "检测到左手向左挥！"
   - 调试面板中"向左挥手"是否显示 "是 ✓"
   - 游戏中的角色是否左转

2. **向右挥右手** → 观察：
   - 视频小窗是否显示 "右挥 ▶"
   - 控制台是否输出 "检测到右手向右挥！"
   - 调试面板中"向右挥手"是否显示 "是 ✓"
   - 游戏中的角色是否右转

3. **向上挥手** → 观察：
   - 视频小窗是否显示 "▲ 上挥"
   - 控制台是否输出 "检测到左手/右手向上挥！"
   - 调试面板中"向上挥手"是否显示 "是 ✓"
   - 游戏中的角色是否加速

4. **握拳** → 观察：
   - 视频小窗是否显示 "✊ 握拳刹车"
   - 调试面板中"握拳检测"是否显示 "是 ✓"
   - 游戏中的角色是否刹车停止

### 步骤5: 查看日志
如果某个手势检测不到，查看控制台输出的速度值：
- `velX` 的绝对值是否大于 `threshold`
- 如果小于阈值，说明动作幅度太小，需要：
  1. 增大动作幅度
  2. 或者进一步降低阈值（修改 `PARAMS.waveVelocityThreshold`）

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
waveVelocityThreshold: 0.02,  // 从 0.05 降低到 0.02
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

## 参数调整

在代码的第137-148行，可以调整这些参数：

```javascript
const PARAMS = {
  waveVelocityThreshold: 0.05,   // 左右挥手速度阈值（降低更容易触发）
  waveUpVelocityThreshold: 0.08,  // 向上挥手速度阈值（降低更容易触发）
  fistDistanceThreshold: 0.25,     // 握拳距离阈值（提高更容易触发）
};
```

**建议**:
- 如果检测不到手势 → 降低 `waveVelocityThreshold` 和 `waveUpVelocityThreshold`
- 如果误触发太多 → 提高 `waveVelocityThreshold` 和 `waveUpVelocityThreshold`
- 如果握拳检测不到 → 提高 `fistDistanceThreshold`
- 如果误触发握拳 → 降低 `fistDistanceThreshold`

## 文件对比

- `game-v6.html` - 原始文件（有问题）
- `game-v6-debug.html` - 调试版本（当前使用，包含详细日志和可视化）

测试成功后，可以将调试代码清理掉，移植到 `game-v6.html` 中。
