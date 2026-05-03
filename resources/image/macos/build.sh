#!/bin/bash
# build.sh — 编译 macOS 通用二进制 dylib
#
# 在 macOS 上运行:
#   chmod +x build.sh && ./build.sh
#
# 输出: resources/image/macos/universal/img_helper.dylib

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/universal"
mkdir -p "$OUTPUT_DIR"

echo "=== 编译 macOS img_helper.dylib ==="

# 编译 arm64
echo "[1/3] 编译 arm64..."
clang -arch arm64 -O2 -dynamiclib \
    -o "$OUTPUT_DIR/img_helper_arm64.dylib" \
    "$SCRIPT_DIR/img_helper.c" \
    -framework Foundation \
    -current_version 1.0.0 \
    -compatibility_version 1.0.0

# 编译 x86_64
echo "[2/3] 编译 x86_64..."
clang -arch x86_64 -O2 -dynamiclib \
    -o "$OUTPUT_DIR/img_helper_x86_64.dylib" \
    "$SCRIPT_DIR/img_helper.c" \
    -framework Foundation \
    -current_version 1.0.0 \
    -compatibility_version 1.0.0

# 合并为通用二进制
echo "[3/3] 合并为通用二进制..."
lipo -create \
    "$OUTPUT_DIR/img_helper_arm64.dylib" \
    "$OUTPUT_DIR/img_helper_x86_64.dylib" \
    -output "$OUTPUT_DIR/img_helper.dylib"

# 清理中间文件
rm -f "$OUTPUT_DIR/img_helper_arm64.dylib" "$OUTPUT_DIR/img_helper_x86_64.dylib"

# 验证
echo ""
echo "=== 验证 ==="
lipo -info "$OUTPUT_DIR/img_helper.dylib"
ls -lh "$OUTPUT_DIR/img_helper.dylib"

echo ""
echo "完成: $OUTPUT_DIR/img_helper.dylib"
