# 修复报告：交换左右手方向检测（v14）

## 问题描述

**现象**：用户报告"方向会错乱"，即：
- 左手向外挥时，角色向右转（应该左转）
- 右手向外挥时，角色向左转（应该右转）

## 根本原因

**"从身体中心向外挥"的含义**：
- **左手**：从身体中心向**左手侧**挥（用户在摄像头**右侧**，向外 = 向右移动）
- **右手**：从身体中心向**右手侧**挥（用户在摄像头**左侧**，向外 = 向左移动）

**摄像头坐标系**（MoveNet 看到的）：
- 用户面对摄像头时，左手在画面**右侧**，右手在画面**左侧**
- "向外挥"对于左手 = 向右移动（`velX > 0`）
- "向外挥"对于右手 = 向左移动（`velX < 0`）

**原代码逻辑（错误）**：
```javascript
// 左手：velX < -threshold（向左移动）→ leftWave
if (velX < -PARAMS.waveVelocityThreshold) {
  leftWave = true;  // ❌ 这是"向内挥"，不是"向外挥"
}

// 右手：velX > threshold（向右移动）→ rightWave
if (velX > PARAMS.waveVelocityThreshold) {
  rightWave = true;  // ❌ 这是"向内挥"，不是"向外挥"
}
```

**修复后逻辑（正确）**：
```javascript
// 左手在画面右侧，"向外挥" = 向右移动 → velX > threshold
if (velX > PARAMS.waveVelocityThreshold) {
  leftWave = true;  // ✅ 这才是"向外挥"
}

// 右手在画面左侧，"向外挥" = 向左移动 → velX < -threshold
if (velX < -PARAMS.waveVelocityThreshold) {
  rightWave = true;  // ✅ 这才是"向外挥"
}
```

## 修改内容

### 1. 交换 `detectWave()` 中的左右手检测条件

**文件位置**：第430-432行（左手）、第472-474行（右手）

**修改前**：
```javascript
// 左手
if (velX < -PARAMS.waveVelocityThreshold) {
  leftWave = true;
  console.log('[detectWave] 🎉 检测到左手向左挥！...');
}

// 右手
if (velX > PARAMS.waveVelocityThreshold) {
  rightWave = true;
  console.log('[detectWave] 🎉 检测到右手向右挥！...');
}
```

**修改后**：
```javascript
// 左手（在画面右侧，"向外挥" = 向右移动）
if (velX > PARAMS.waveVelocityThreshold) {
  leftWave = true;
  console.log('[detectWave] 🎉 检测到左手向外挥！...');
}

// 右手（在画面左侧，"向外挥" = 向左移动）
if (velX < -PARAMS.waveVelocityThreshold) {
  rightWave = true;
  console.log('[detectWave] 🎉 检测到右手向外挥！...');
}
```

### 2. 更新注释和UI提示

**第131行**（底部提示）：
```html
<!-- 修改前 -->
<div id="hintBottom">体感：左手向左挥=左转 右手向右挥=右转 ...</div>

<!-- 修改后 -->
<div id="hintBottom">体感：左手向外挥=左转 右手向外挥=右转 ...</div>
```

**第591-595行**（映射规则注释）：
```javascript
// 修改前
// - 左手向左挥 (velX < 0) → 左转 (rawDir = -1)
// - 右手向右挥 (velX > 0) → 右转 (rawDir = 1)

// 修改后
// - 左手在摄像头画面右侧，向外挥 = 向右移动 (velX > 0) → 左转 (rawDir = -1)
// - 右手在摄像头画面左侧，向外挥 = 向左移动 (velX < 0) → 右转 (rawDir = 1)
```

### 3. 更新调试日志

**第424-426行**（左手方向日志）：
```javascript
// 修改前
console.log(`[detectWave] 左手 X 方向: ${velX > 0 ? '向右' : '向左'} ...`);

// 修改后
console.log(`[detectWave] 左手 X 方向: ${velX > 0 ? '向外(右)' : '向内(左)'} ...`);
```

**第467-469行**（右手方向日志）：
```javascript
// 修改前
console.log(`[detectWave] 右手 X 方向: ${velX > 0 ? '向右' : '向左'} ...`);

// 修改后
console.log(`[detectWave] 右手 X 方向: ${velX < 0 ? '向外(左)' : '向内(右)'} ...`);
```

## 修改文件

**文件**：`C:/Users/admin/WorkBuddy/20260428175909/game-v6-debug.html`

**版本**：`2025-04-30-v13` → `2025-04-30-v14`

**修改位置**：
- 第2行：版本号
- 第131行：底部提示文字
- 第424-426行：左手调试日志
- 第428-432行：左手检测条件
- 第467-469行：右手调试日志
- 第471-474行：右手检测条件
- 第591-595行：映射规则注释

## 测试步骤

1. **清除浏览器缓存**
   - 按 `Ctrl + Shift + R`
   - 确认版本号：`VERSION: 2025-04-30-v14`

2. **测试流程**
   - 开启摄像头，等待 MoveNet 加载
   - **左手从身体中心向外挥**（向你的左手侧挥）
   - 观察"体感数据面板"：
     - "向左挥手"应该显示"是 ✓"
     - 控制台输出：`[detectWave] 🎉 检测到左手向外挥！`
   - 等待角色到达路口
   - 观察角色是否**左转**

3. **测试右手**
   - **右手从身体中心向外挥**（向你的右手侧挥）
   - 观察"体感数据面板"：
     - "向右挥手"应该显示"是 ✓"
     - 控制台输出：`[detectWave] 🎉 检测到右手向外挥！`
   - 等待角色到达路口
   - 观察角色是否**右转**

4. **预期结果**
   - ✅ 左手向外挥 → 角色左转
   - ✅ 右手向外挥 → 角色右转
   - ✅ 控制台日志清晰显示"向外挥"

## 调试日志示例

**正确的日志输出**：
```
[detectWave] 左手 X 方向: 向外(右) (velX=0.125, threshold=0.03)
[detectWave] 🎉 检测到左手向外挥！velX= 0.125 velY= 0.042
[MoveNet] 检测到向左挥手！→ 左转 (rawDir=-1)
```

```
[detectWave] 右手 X 方向: 向外(左) (velX=-0.118, threshold=0.03)
[detectWave] 🎉 检测到右手向外挥！velX= -0.118 velY= 0.035
[MoveNet] 检测到向右挥手！→ 右转 (rawDir=1)
```

## 如果还是方向错乱

### 可能原因1：摄像头镜像问题

如果还是不对，可能是摄像头画面被镜像了（左右颠倒）。

**检查方法**：
1. 在摄像头画面前举左手
2. 观察视频小窗：左手是否出现在画面**左侧**？
   - 如果是 → 画面被镜像了，需要调整代码
   - 如果否 → 画面正常（左手在右侧），代码应该正确

**解决方案**：
如果是镜像问题，需要再次交换左右手检测条件。

### 可能原因2：用户理解不一致

"从身体中心向外挥"可能有不同理解：
- **理解A**：左手向**用户左手侧**挥（我的代码假设这个）
- **理解B**：左手向**摄像头画面左侧**挥

如果用户是理解B，那么需要再次交换检测条件。

## 下一步

**测试这个版本**，然后告诉我结果：
- ✅ 如果方向正确了 → 问题解决
- ❌ 如果还是错乱 → 截图控制台日志，我会再次调整

---

**修复时间**：2026-04-30  
**修复人**：AI Assistant  
**状态**：待测试
