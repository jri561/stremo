#!/usr/bin/env bash
# Création d'une archive portable de distribution Linux pour Stremo

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist-linux"
PACKAGE_NAME="stremo-linux-x64-v1.0.0"
TARGET_DIR="$DIST_DIR/$PACKAGE_NAME"

echo "📦 Préparation du paquet Linux portable Stremo..."

# 1. Build de production
npm run build --prefix "$PROJECT_DIR/client"
npm run build --prefix "$PROJECT_DIR/server"

# 2. Création de l'arborescence
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR/client"
mkdir -p "$TARGET_DIR/server"
mkdir -p "$TARGET_DIR/bin"
mkdir -p "$TARGET_DIR/scripts"

# 3. Copie des fichiers compilés et nécessaires
cp -r "$PROJECT_DIR/client/dist" "$TARGET_DIR/client/"
cp -r "$PROJECT_DIR/client/public" "$TARGET_DIR/client/"
cp "$PROJECT_DIR/client/package.json" "$TARGET_DIR/client/"

cp -r "$PROJECT_DIR/server/dist" "$TARGET_DIR/server/"
cp "$PROJECT_DIR/server/package.json" "$TARGET_DIR/server/"

cp "$PROJECT_DIR/bin/stremo" "$TARGET_DIR/bin/"
cp "$PROJECT_DIR/scripts/launch-desktop.mjs" "$TARGET_DIR/scripts/"
cp "$PROJECT_DIR/scripts/install-linux.sh" "$TARGET_DIR/scripts/"
cp "$PROJECT_DIR/stremo.desktop" "$TARGET_DIR/"
cp "$PROJECT_DIR/README.md" "$TARGET_DIR/"

# 4. Création de l'archive tar.gz
cd "$DIST_DIR"
tar -czf "${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME"
sha256sum "${PACKAGE_NAME}.tar.gz" > "${PACKAGE_NAME}.tar.gz.sha256"

SIZE_MB=$(du -m "${PACKAGE_NAME}.tar.gz" | cut -f1)
echo "✅ Paquet Linux généré avec succès ($SIZE_MB Mo) : $DIST_DIR/${PACKAGE_NAME}.tar.gz"
echo "   • Checksum : $DIST_DIR/${PACKAGE_NAME}.tar.gz.sha256"

