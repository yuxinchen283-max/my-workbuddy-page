#!/usr/bin/env python3
"""
合并 game-v5.html 和 game-v7-fixed.html
- 使用 game-v5.html 作为基础（完整的3D游戏逻辑）
- 用 game-v7-fixed.html 中的修正后姿态检测代码替换原代码
"""

# 读取整个文件作为字符串
with open('game-v5.html', 'r', encoding='utf-8') as f:
    v5_content = f.read()

with open('game-v7-fixed.html', 'r', encoding='utf-8') as f:
    v7_content = f.read()

# 从 v7 提取修正后的姿态检测代码
# v7 的结构：行 173-657 是姿态检测 IIFE
# 需要找到正确的开始和结束位置

# 在 v7 中找到姿态检测代码的开始和结束
# 开始："(function(){" 之后是姿态检测代码
# 结束："})(\";" 之前

v7_start_marker = "// ============================================================\n// 摄像头识别 - TensorFlow.js MoveNet 实时骨骼追踪 (v7 修复版)\n// ============================================================"
v7_end_marker = "// ============================================================\n// 输入系统"

v7_start_idx = v7_content.find(v7_start_marker)
v7_end_idx = v7_content.find(v7_end_marker)

if v7_start_idx == -1:
    print("错误：找不到 v7 姿态检测代码开始标记")
    exit(1)
if v7_end_idx == -1:
    print("错误：找不到 v7 姿态检测代码结束标记")
    exit(1)

v7_pose_code = v7_content[v7_start_idx:v7_end_idx].strip()

# 在 v5 中找到需要替换的代码段
v5_start_marker = "// ============================================================\n// 摄像头识别 - TensorFlow.js MoveNet 实时骨骼追踪\n// ============================================================"
v5_end_marker = "// ============================================================\n// 输入系统"

v5_start_idx = v5_content.find(v5_start_marker)
v5_end_idx = v5_content.find(v5_end_marker)

if v5_start_idx == -1:
    print("错误：找不到 v5 姿态检测代码开始标记")
    exit(1)
if v5_end_idx == -1:
    print("错误：找不到 v5 姿态检测代码结束标记")
    exit(1)

# 执行替换
new_content = v5_content[:v5_start_idx] + v7_pose_code + "\n\n" + v5_content[v5_end_idx:]

# 写入新文件
with open('game-v8-merged.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

# 统计行数
line_count = new_content.count('\n') + 1

print(f"合并完成！")
print(f"新文件: game-v8-merged.html")
print(f"总行数: {line_count}")

# 验证关键部分是否存在
checks = [
    ("KP = {", "MoveNet 关键点定义"),
    ("BONES = [", "骨骼连接定义"),
    ("function initThreeGame()", "Three.js 初始化"),
    ("function buildGround()", "地面构建"),
    ("function buildRoads()", "道路构建"),
    ("function buildPlayer()", "玩家构建"),
]

print("\n验证关键代码段：")
for marker, desc in checks:
    if marker in new_content:
        print(f"  ✓ {desc}")
    else:
        print(f"  ✗ {desc} (缺失)")
