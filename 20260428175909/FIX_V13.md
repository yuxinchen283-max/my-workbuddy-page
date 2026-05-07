# 修复报告：方向意图保持逻辑（v13）

## 问题描述

**现象**：日志显示已检测到左右挥手（`[MoveNet] 检测到向左挥手！→ 左转 (rawDir=-1)`），但角色到达路口时没有转向。

## 根本原因

**挥手是瞬时动作**：
- 只有 1-2 帧 `rawDir` 非 0（检测到挥手的那一刻）
- 之后 `rawDir` 就被重置为 0（因为没有持续挥手）
- 当角色**真正到达路口**时，`horizontalIntent` 已经是 0 了
- 所以 `chooseNextSegment()` 收到的 `horizInput = 0`，不会转向

**时间线**：
```
t=0.0s  ─ 用户挥手 → rawDir = -1
t=0.1s  ─ 挥手结束 → rawDir = 0
...
t=3.5s  ─ 角色到达路口 → Input.horizontalIntent = 0 → 不转向！
```

## 解决方案

**让方向意图保持 2 秒**，给角色到达路口的时间。

### 技术实现

1. **添加新字段**（第1112-1122行）：
```javascript
const Input = {
  ...
  lastIntentTime: 0,  // 最后一次挥手的时间
  pendingIntent: 0,   // 待处理的方向意图（保持2秒）
  update(dt) {
    ...
  }
};
```

2. **保持方向意图**（第1166-1182行）：
```javascript
// 水平方向输入
di = ca.action.horizontalIntent;

// ✅ 修复：保持方向意图2秒，给角色到达路口的时间
if (di !== 0) {
  this.lastIntentTime = now;
  this.pendingIntent = di;
} else if (this.pendingIntent !== 0 && (now - this.lastIntentTime) < 2.0) {
  // 如果在2秒内，保持之前的方向意图
  di = this.pendingIntent;
} else if (this.pendingIntent !== 0) {
  // 超过2秒，清除意图
  this.pendingIntent = 0;
}
```

3. **使用意图后清除**（第1730-1741行）：
```javascript
const nextSeg = chooseNextSegment(seg, reachedNode, Input.horizontalIntent);
if (nextSeg) {
  ...
  // ✅ 修复：使用方向意图后，清除它
  if (Input.horizontalIntent !== 0) {
    console.log('[updatePlayer] 已使用方向意图:', Input.horizontalIntent, '| 清除 pendingIntent');
    Input.pendingIntent = 0;
    Input.horizontalIntent = 0;
  }
}
```

4. **UI 显示**（第78-81行）：
```html
<div class="data-row"><span class="label">待处理意图：</span><span class="value" id="dataPendingIntent">0</span></div>
```

## 修改文件

**文件**：`C:/Users/admin/WorkBuddy/20260428175909/game-v6-debug.html`

**版本**：`2025-04-30-v12` → `2025-04-30-v13`

**修改位置**：
- 第2行：版本号
- 第78行：添加"待处理意图"UI
- 第1112-1122行：初始化 `lastIntentTime` 和 `pendingIntent`
- 第1166-1182行：保持方向意图逻辑
- 第1730-1741行：使用意图后清除
- 第1043-1053行：显示 `pendingIntent`

## 测试步骤

1. **清除浏览器缓存**
   - 按 `Ctrl + Shift + R`（强制刷新）
   - 或打开开发者工具（F12）→ 右键刷新按钮 → "清空缓存并硬性重新加载"

2. **确认版本号**
   - 查看页面源代码第一行，确认：`VERSION: 2025-04-30-v13`

3. **测试流程**
   - 开启摄像头，等待 MoveNet 加载
   - 在角色**接近路口前**挥手（左挥或右挥）
   - 观察"体感数据面板"：
     - "方向意图"应该显示"左转 ◀"或"右转 ▶"
     - "待处理意图"也应该显示相同的方向
   - 等待角色到达路口
   - 观察角色是否转向

4. **预期结果**
   - ✅ 控制台输出：`[updatePlayer] 已使用方向意图: -1 | 清除 pendingIntent`
   - ✅ 角色按照挥手方向转向
   - ✅ 转向后，"待处理意图"重置为 0

5. **如果超过2秒还没到路口**
   - "待处理意图"会自动清除（避免过期意图影响下一次转向）
   - 需要在接近下一个路口时重新挥手

## 调试日志

**新增日志**（第1170-1173行）：
```javascript
if (this.logCounter % 30 === 0) {
  console.log('[Input] 保持方向意图:', di, '| 已过去:', (now - this.lastIntentTime).toFixed(2), '秒');
}
```

**新增日志**（第1736-1739行）：
```javascript
if (Input.horizontalIntent !== 0) {
  console.log('[updatePlayer] 已使用方向意图:', Input.horizontalIntent, '| 清除 pendingIntent');
  Input.pendingIntent = 0;
  Input.horizontalIntent = 0;
}
```

## 参数调整

**方向意图保持时间**：
- 当前值：2.0 秒
- 位置：第1168行 `&& (now - this.lastIntentTime) < 2.0`
- 如果需要更长时间，可以改为 3.0 或 4.0

**建议**：
- 如果角色速度较慢，需要更长的保持时间
- 如果路口距离较远，也需要更长的保持时间

## 已知限制

1. **如果超过2秒角色还没到路口**，意图会过期
   - 解决方案：重新挥手，或增加保持时间

2. **如果连续挥手两次**（左挥然后右挥）
   - 只有最后一次挥手的方向会被保留

3. **如果2秒内到达路口**，但路口只有一个方向（直行）
   - `chooseNextSegment()` 会强制选择唯一可用的路段
   - 方向意图不会影响选择

## 下一步

如果这次修复还是不工作，请提供：
1. **完整的控制台日志**（包含 `[Input] 保持方向意图` 和 `[updatePlayer] 已使用方向意图`）
2. **体感数据面板截图**（特别是"待处理意图"部分）
3. **说明**：角色是否到达路口？是否选择了新路段？

---
**修复时间**：2026-04-30
**修复人**：AI Assistant
**状态**：待测试
