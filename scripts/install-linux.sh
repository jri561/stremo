#!/usr/bin/env bash
# Installation de Stremo sur environnement Linux de bureau (GNOME, KDE, XFCE, etc.)

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICON_PNG_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"
ICON_SVG_DIR="${HOME}/.local/share/icons/hicolor/scalable/apps"

echo "=========================================="
echo "  Installation de Stremo Desktop (Linux)  "
echo "=========================================="
echo "Dossier source : $PROJECT_DIR"

# 1. Création des répertoires cibles
mkdir -p "$BIN_DIR"
mkdir -p "$DESKTOP_DIR"
mkdir -p "$ICON_PNG_DIR"
mkdir -p "$ICON_SVG_DIR"

# 2. Installation des icônes
echo "🎨 Installation des icônes..."
cp "$PROJECT_DIR/client/public/icon-512.png" "$ICON_PNG_DIR/stremo.png"
cp "$PROJECT_DIR/client/public/favicon.svg" "$ICON_SVG_DIR/stremo.svg"

# 3. Création du lien symbolique dans ~/.local/bin
echo "⚡ Installation de l'exécutable dans $BIN_DIR/stremo..."
ln -sf "$PROJECT_DIR/bin/stremo" "$BIN_DIR/stremo"
chmod +x "$PROJECT_DIR/bin/stremo"

# 4. Génération du fichier .desktop avec le chemin absolu
echo "🖥️ Installation de l'entrée de bureau dans $DESKTOP_DIR/stremo.desktop..."
cat <<EOF > "$DESKTOP_DIR/stremo.desktop"
[Desktop Entry]
Name=Stremo
GenericName=Cinéma Privé & Streaming
Comment=Stremo regroupe vos catalogues, favoris, historique familial et lecteurs vidéo en une expérience fluide.
Exec=$BIN_DIR/stremo
Icon=stremo
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;
StartupWMClass=stremo
Keywords=stremio;streaming;movies;series;tv;video;
EOF

chmod +x "$DESKTOP_DIR/stremo.desktop"

# 5. Mise à jour du cache de bureau Linux
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true
fi

echo ""
echo "✅ Stremo a été installé avec succès sur votre bureau Linux !"
echo "👉 Vous pouvez désormais lancer Stremo depuis votre menu d'applications ou via la commande :"
echo "   stremo"
echo ""
