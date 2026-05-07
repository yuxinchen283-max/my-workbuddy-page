#!/usr/bin/env python3
"""
合并 game-v5.html 和 game-v7-fixed.html
- 使用 game-v5.html 作为基础（完整的3D游戏逻辑）
- 用 game-v7-fixed.html 中的修正后姿态检测代码替换原代码
- 更新所有引用以匹配新的常量名称
"""

import re

# 读取文件
with open('game-v5.html', 'r', encoding='utf-8') as f:
    v5_lines = f.readlines()

with open('game-v7-fixed.html', 'r', encoding='utf-8') as f:
    v7_lines = f.readlines()

# 从 v7 提取修正后的姿态检测代码 (行 173-657, 0-indexed: 172-656)
v7_pose_start = 172  # 第173行
v7_pose_end = 657     # 第657行 (包含)
v7_pose_code = ''.join(v7_lines[v7_pose_start:v7_pose_end])

# v5 中需要替换的部分 (行 177-915, 0-indexed: 176-914)
v5_old_start = 176  # 第177行
v5_old_end = 915      # 第915行 (包含)

# 构建新文件
# 1. v5 的前半部分 (行 1-176)
new_file_lines = v5_lines[:v5_old_start]

# 2. 插入 v7 的修正后姿态检测代码
new_file_lines.append(v7_pose_code)

# 3. v5 的后半部分 (行 916-2074)
# 注意：需要修改这部分代码以使用新的常量名
v5_tail = ''.join(v5_lines[v5_old_end:])

# 替换常量引用：KEYPOINT -> KP, CONNECTIONS -> BONES
replacements = [
    ('KEYPOINT.', 'KP.'),
    ('KEYPOINT)', 'KP)'),
    ('KEYPOINT,', 'KP,'),
    ('KEYPOINT]', 'KP]'),
    ('CONNECTIONS', 'BONES'),
    ('confirmedDir', 'state.action.horizontalIntent'),  # v7 使用 state.action.horizontalIntent
    ('state.confidence', 'state.confidence'),  # 保持一致性
]

modified_tail = v5_tail
for old, new in replacements:
    modified_tail = modified_tail.replace(old, new)

new_file_lines.append(modified_tail)

# 写入新文件
with open('game-v8-merged.html', 'w', encoding='utf-8') as f:
    f.writelines(new_file_lines)

print(f"合并完成！")
print(f"新文件: game-v8-merged.html")
print(f"总行数: {len(new_file_lines)}")
