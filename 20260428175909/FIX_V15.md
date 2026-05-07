# 修复报告：交换左右手方向映射（v15）

## 问题描述

**用户反馈**："现在右手左挥向左，左手右挥向右，逻辑错误了，调整"

**现象**：
- 右手向左挥 → 角色向左转（应该向右转）
- 左手向右挥 → 角色向右转（应该向左转）
- **方向完全反了**

## 根本原因

**原映射逻辑（v12-v14）**：
```javascript
if (waves.leftWave) {
  rawDir = -1;  // 左转
}
if (waves.rightWave) {
  rawDir = 1;   // 右转
}
```

**问题分析**：
- `rawDir = -1` → 左转
- `rawDir = 1` → 右转
- 但用户反馈方向反了，说明映射应该交换

## 解决方案

**交换 `processLandmarks()` 中的方向映射**。

### 修改内容

**文件位置**：第609-620行

**修改前**：
```javascript
let rawDir = 0;
if (waves.leftWave) {
  rawDir = -1;
  state.turnHint = 'left';
  console.log('[MoveNet] 检测到向左挥手！→ 左转 (rawDir=-1)');
} else if (waves.rightWave) {
  rawDir = 1;
  state.turnHint = 'right';
  console.log('[MoveNet] 检测到向右挥手！→ 右转 (rawDir=1)');
}
```

**修改后**：
```javascript
let rawDir = 0;
if (waves.leftWave) {
  rawDir = 1;  // ✅ 修改：左手挥 → 右转
  state.turnHint = 'right';
  console.log('[MoveNet] 检测到左手挥！→ 右转 (rawDir=1)');
} else if (waves.rightWave) {
  rawDir = -1; // ✅ 修改：右手挥 → 左转
  state.turnHint = 'left';
  console.log('[MoveNet] 检测到右手挥！→ 左转 (rawDir=-1)');
}
```

## 手势映射规则（v15 最终版）

| 手势 | 摄像头坐标系 | 触发条件 | rawDir | 游戏动作 |
|------|-------------|----------|--------|----------|
| **左手向左挥** | 从右向左 (velX < 0) | `velX < -threshold` | `rawDir = 1` | **右转** |
| **右手向右挥** | 从左向右 (velX > 0) | `velX > threshold` | `rawDir = -1` | **左转** |
| **向上挥手** | 任意手 Y 方向速度 < -0.05 **且** 手腕高于肩膀 | `velY < -threshold && wrist < shoulder` | - | 加速 |
| **握拳** | 任意手手腕靠近肘部（距离 < 0.3） | `fistDistance < threshold` | - | 停止 |

## 修改文件

**文件**：`C:/Users/admin/WorkBuddy/20260428175909/game-v6-debug.html`

**版本**：`2025-04-30-v14` → `2025-04-30-v15`

**修改位置**：
- 第2行：版本号
- 第131行：底部提示文字（"左手挥=右转 右手挥=左转"）
- 第424-426行：左手调试日志
- 第428-432行：左手检测条件（`velX < -threshold`）
- 第466-470行：右手调试日志
- 第472-476行：右手检测条件（`velX > threshold`）
- 第592-597行：映射规则注释
- 第609-620行：方向映射逻辑（交换）

## 测试步骤

1. **清除浏览器缓存**
   - 按 `Ctrl + Shift + R`
   - 确认版本号：`VERSION: 2025-04-30-v15`

2. **测试左手**
   - **左手向左挥**（从右向左）
   - 观察"体感数据面板"：
     - "向左挥手"应该显示"是 ✓"
     - 控制台输出：`[detectWave] 🎉 检测到左手向外挥！`
   - 等待角色到达路口
   - 观察角色是否**右转**（不是左转！）

3. **测试右手**
   - **右手向右挥**（从左向右）
   - 观察"体感数据面板"：
     - "向右挥手"应该显示"是 ✓"
     - 控制台输出：`[detectWave] 🎉 检测到右手向外挥！`
   - 等待角色到达路口
   - 观察角色是否**左转**（不是右转！）

4. **预期结果**
   - ✅ 左手向左挥 → 角色**右转**
   - ✅ 右手向右挥 → 角色**左转**
   - ✅ 控制台日志：`[MoveNet] 检测到左手挥！→ 右转 (rawDir=1)`

## 调试日志示例

**正确的日志输出**：
```
[detectWave] 左手 X 方向: 向外(左挥) (velX=-0.118, threshold=0.03)
[detectWave] 🎉 检测到左手向外挥！velX= -0.118 velY= 0.035
[MoveNet] 检测到左手挥！→ 右转 (rawDir=1)
```

```
[detectWave] 右手 X 方向: 向外(右挥) (velX=0.125, threshold=0.03)
[detectWave] 🎉 检测到右手向外挥！velX= 0.125 velY= 0.042
[MoveNet] 检测到右手挥！→ 左转 (rawDir=-1)
```

## 如果还是方向错乱

### 可能原因1：需要再次交换

如果测试后还是反了，说明需要再次交换映射。

**解决方案**：
```javascript
// 再次交换
if (waves.leftWave) {
  rawDir = -1;  // 左转
}
if (waves.rightWave) {
  rawDir = 1;   // 右转
}
```

### 可能原因2：检测条件反了

如果检测条件（`velX` 的正负）反了，需要调整 `detectWave()` 函数。

**解决方案**：
- 左手：`velX < -threshold` ↔ `velX > threshold`
- 右手：`velX > threshold` ↔ `velX < -threshold`

## 下一步

**测试这个版本**，然后告诉我结果：
- ✅ 如果方向正确了 → 问题解决
- ❌ 如果还是错乱 → 截图控制台日志，我会再次调整

---

**修复时间**：2026-04-30 20:15  
**修复人**：AI Assistant  
**状态**：待测试
