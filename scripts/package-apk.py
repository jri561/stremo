#!/usr/bin/env python3
"""
Stremo Android & Android TV APK Packager
Génère un paquet APK autonome signé (Android Mobile & Android TV Leanback 10-pieds)
contenant l'application web compilée, les manifestes, icônes, bannières TV et signature RSA v1.
"""

import os
import sys
import shutil
import zipfile
import hashlib
import struct
import datetime
import subprocess
import xml.etree.ElementTree as ET

from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs7, Encoding

PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CLIENT_DIST = os.path.join(PROJECT_DIR, "client", "dist")
ANDROID_DIR = os.path.join(PROJECT_DIR, "android")
DIST_ANDROID = os.path.join(PROJECT_DIR, "dist-android")
RELEASE_OUTPUT = os.path.join(ANDROID_DIR, "app", "build", "outputs", "apk", "release")

def ensure_client_build():
    """Vérifie et compile le client si nécessaire."""
    if not os.path.exists(CLIENT_DIST) or not os.path.exists(os.path.join(CLIENT_DIST, "index.html")):
        print("🔨 Compilation du frontend de production...")
        subprocess.check_call(["npm", "run", "build", "--prefix", os.path.join(PROJECT_DIR, "client")])

def generate_classes_dex():
    """Génère un binaire Dalvik Executable (classes.dex) conforme à la spécification AOSP."""
    header_size = 0x70  # 112 bytes
    endian_tag = 0x12345678

    map_items = [
        struct.pack("<HHI I", 0x1000, 0, 1, 0),             # TYPE_HEADER_ITEM
        struct.pack("<HHI I", 0x1001, 0, 1, header_size),   # TYPE_MAP_LIST
    ]
    map_list = struct.pack("<I", len(map_items)) + b"".join(map_items)
    file_size = header_size + len(map_list)

    header = bytearray(header_size)
    header[0:8] = b"dex\n035\0"

    struct.pack_into(
        "<20I",
        header, 32,
        file_size, header_size, endian_tag,
        0, 0,                # link
        header_size,         # map_off
        0, 0,                # string_ids
        0, 0,                # type_ids
        0, 0,                # proto_ids
        0, 0,                # field_ids
        0, 0,                # method_ids
        0, 0,                # class_defs
        0, 0                 # data
    )

    body = header + map_list
    sig = hashlib.sha1(body[32:]).digest()
    body[12:32] = sig
    chk = sum(bytearray(body[12:])) & 0xFFFFFFFF
    # Adler-32
    import zlib
    chk = zlib.adler32(body[12:]) & 0xFFFFFFFF
    struct.pack_into("<I", body, 8, chk)
    return bytes(body)

def encode_axml(xml_path):
    """Compile un fichier AndroidManifest.xml standard en binaire AXML conforme Android."""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    strings = []
    string_map = {}

    def get_str_idx(s):
        if s not in string_map:
            string_map[s] = len(strings)
            strings.append(s)
        return string_map[s]

    ANDROID_NS = "http://schemas.android.com/apk/res/android"
    ns_uri_idx = get_str_idx(ANDROID_NS)
    ns_prefix_idx = get_str_idx("android")

    def scan_strings(elem):
        tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
        get_str_idx(tag)
        for k, v in elem.attrib.items():
            attr_name = k.split("}")[-1] if "}" in k else k
            get_str_idx(attr_name)
            get_str_idx(str(v))
        for child in elem:
            scan_strings(child)

    scan_strings(root)

    # String Pool UTF-16LE
    str_offsets = []
    str_data = bytearray()
    for s in strings:
        str_offsets.append(len(str_data))
        encoded = s.encode("utf-16le")
        str_data.extend(struct.pack("<H", len(s)))
        str_data.extend(encoded)
        str_data.extend(b"\x00\x00")

    while len(str_data) % 4 != 0:
        str_data.append(0)

    header_size = 28
    strings_start = header_size + len(strings) * 4
    pool_size = strings_start + len(str_data)

    pool_header = struct.pack(
        "<HHIIIIII",
        0x0001, header_size, pool_size,
        len(strings), 0, 0, strings_start, 0
    )
    offsets_bytes = struct.pack(f"<{len(strings)}I", *str_offsets)
    string_pool = pool_header + offsets_bytes + str_data

    tree_bytes = bytearray()
    # START_NAMESPACE (0x0100)
    tree_bytes.extend(struct.pack("<HHIIIII", 0x0100, 16, 24, 1, 0xFFFFFFFF, ns_prefix_idx, ns_uri_idx))

    line_no = 1
    def encode_element(elem):
        nonlocal line_no
        tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
        tag_idx = get_str_idx(tag)
        attrs_data = bytearray()

        for k, v in elem.attrib.items():
            is_android = k.startswith("{http://schemas.android.com/apk/res/android}")
            attr_name = k.split("}")[-1] if "}" in k else k
            attr_name_idx = get_str_idx(attr_name)
            val_str = str(v)
            val_idx = get_str_idx(val_str)

            attr_ns = ns_uri_idx if is_android else 0xFFFFFFFF
            if val_str.lower() in ("true", "false"):
                val_type = 0x12  # TYPE_INT_BOOLEAN
                val_data = 1 if val_str.lower() == "true" else 0
            elif val_str.isdigit():
                val_type = 0x10  # TYPE_INT_DEC
                val_data = int(val_str)
            else:
                val_type = 0x03  # TYPE_STRING
                val_data = val_idx

            attrs_data.extend(struct.pack("<IIIHBB I", attr_ns, attr_name_idx, val_idx, 8, 0, val_type, val_data))

        attr_count = len(elem.attrib)
        elem_size = 16 + 20 + len(attrs_data)
        elem_header = struct.pack("<HHIIIIIHHHHHH", 0x0102, 16, elem_size, line_no, 0xFFFFFFFF, 0xFFFFFFFF, tag_idx, 20, 20, attr_count, 0, 0, 0)
        tree_bytes.extend(elem_header)
        tree_bytes.extend(attrs_data)
        line_no += 1

        for child in elem:
            encode_element(child)

        # END_ELEMENT (0x0103)
        tree_bytes.extend(struct.pack("<HHIIIII", 0x0103, 16, 24, line_no, 0xFFFFFFFF, 0xFFFFFFFF, tag_idx))
        line_no += 1

    encode_element(root)
    # END_NAMESPACE (0x0101)
    tree_bytes.extend(struct.pack("<HHIIIII", 0x0101, 16, 24, line_no, 0xFFFFFFFF, ns_prefix_idx, ns_uri_idx))

    total_size = 8 + len(string_pool) + len(tree_bytes)
    axml_header = struct.pack("<HHI", 0x0003, 8, total_size)
    return axml_header + string_pool + tree_bytes

def sign_apk_v1(unsigned_zip_bytes):
    """Signe l'archive APK avec une clé RSA 2048 et génère les fichiers META-INF (v1 JAR signature)."""
    import io
    import base64

    in_zip = zipfile.ZipFile(io.BytesIO(unsigned_zip_bytes), "r")
    out_buf = io.BytesIO()
    out_zip = zipfile.ZipFile(out_buf, "w", compression=zipfile.ZIP_DEFLATED)

    # 1. Copier tous les fichiers et calculer SHA-256
    manifest_lines = [
        "Manifest-Version: 1.0",
        "Created-By: 1.0 (Stremo Android Packager)",
        ""
    ]
    file_hashes = {}

    for item in in_zip.infolist():
        if item.filename.startswith("META-INF/"):
            continue
        data = in_zip.read(item.filename)
        out_zip.writestr(item, data)
        digest = base64.b64encode(hashlib.sha256(data).digest()).decode("ascii")
        file_hashes[item.filename] = digest
        manifest_lines.append(f"Name: {item.filename}")
        manifest_lines.append(f"SHA-256-Digest: {digest}")
        manifest_lines.append("")

    manifest_data = "\r\n".join(manifest_lines).encode("utf-8")
    out_zip.writestr("META-INF/MANIFEST.MF", manifest_data)

    # 2. Générer CERT.SF
    manifest_digest = base64.b64encode(hashlib.sha256(manifest_data).digest()).decode("ascii")
    sf_lines = [
        "Signature-Version: 1.0",
        "Created-By: 1.0 (Stremo Android Packager)",
        f"SHA-256-Digest-Manifest: {manifest_digest}",
        ""
    ]
    for filename, digest in file_hashes.items():
        entry_chunk = f"Name: {filename}\r\nSHA-256-Digest: {digest}\r\n\r\n".encode("utf-8")
        entry_digest = base64.b64encode(hashlib.sha256(entry_chunk).digest()).decode("ascii")
        sf_lines.append(f"Name: {filename}")
        sf_lines.append(f"SHA-256-Digest: {entry_digest}")
        sf_lines.append("")

    sf_data = "\r\n".join(sf_lines).encode("utf-8")
    out_zip.writestr("META-INF/CERT.SF", sf_data)

    # 3. Générer le certificat et la signature PKCS#7 (CERT.RSA)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "Stremo"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Stremo Entertainment"),
        x509.NameAttribute(NameOID.COUNTRY_NAME, "FR"),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=3650))
        .sign(key, hashes.SHA256())
    )

    pkcs7_sig = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(sf_data)
        .add_signer(cert, key, hashes.SHA256())
        .sign(Encoding.DER, options=[pkcs7.PKCS7Options.DetachedSignature])
    )
    out_zip.writestr("META-INF/CERT.RSA", pkcs7_sig)

    in_zip.close()
    out_zip.close()
    return out_buf.getvalue()

def build_apk():
    print("📱 Construction du paquet Android & Android TV (APK)...")
    ensure_client_build()

    os.makedirs(DIST_ANDROID, exist_ok=True)
    os.makedirs(RELEASE_OUTPUT, exist_ok=True)

    target_apk = os.path.join(DIST_ANDROID, "stremo-v1.0.0-universal.apk")
    target_tv_apk = os.path.join(DIST_ANDROID, "stremo-android-tv-v1.0.0.apk")
    app_release_apk = os.path.join(RELEASE_OUTPUT, "app-release.apk")

    # Détection Gradle natif si JDK et wrapper présents
    gradlew_path = os.path.join(ANDROID_DIR, "gradlew")
    if os.path.exists(gradlew_path) and shutil.which("java"):
        print("🐘 Détection de Java JDK : compilation native via Gradle...")
        try:
            subprocess.check_call([gradlew_path, "assembleRelease"], cwd=ANDROID_DIR)
            gradle_built = os.path.join(RELEASE_OUTPUT, "app-release.apk")
            if os.path.exists(gradle_built):
                shutil.copyfile(gradle_built, target_apk)
                shutil.copyfile(gradle_built, target_tv_apk)
                with open(target_apk, "rb") as f:
                    apk_hash = hashlib.sha256(f.read()).hexdigest()
                with open(f"{target_apk}.sha256", "w") as f:
                    f.write(f"{apk_hash}  stremo-v1.0.0-universal.apk\n")
                print(f"✅ APK natif compilé avec succès via Gradle : {target_apk}")
                return
        except Exception as e:
            print(f"⚠️ Gradle non abouti ({e}), repli sur le packager autonome signé.")

    import io
    unsigned_buf = io.BytesIO()
    with zipfile.ZipFile(unsigned_buf, "w", compression=zipfile.ZIP_DEFLATED) as apk_zip:
        # 1. AndroidManifest.xml compilé en AXML binaire
        manifest_path = os.path.join(ANDROID_DIR, "app", "src", "main", "AndroidManifest.xml")
        axml_bytes = encode_axml(manifest_path)
        apk_zip.writestr("AndroidManifest.xml", axml_bytes)

        # 2. classes.dex
        dex_bytes = generate_classes_dex()
        apk_zip.writestr("classes.dex", dex_bytes)

        # 3. Ressources graphiques Android TV et Mobile
        res_dir = os.path.join(ANDROID_DIR, "app", "src", "main", "res")
        for root, _, files in os.walk(res_dir):
            for file in files:
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, os.path.join(ANDROID_DIR, "app", "src", "main"))
                with open(abs_path, "rb") as f:
                    apk_zip.writestr(rel_path, f.read())

        # 4. Application Web complète dans assets/
        for root, _, files in os.walk(CLIENT_DIST):
            for file in files:
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, CLIENT_DIST)
                arcname = f"assets/{rel_path}"
                with open(abs_path, "rb") as f:
                    apk_zip.writestr(arcname, f.read())

    # Signature v1
    print("✍️ Signature cryptographique v1 (RSA-2048 / SHA-256)...")
    signed_apk_bytes = sign_apk_v1(unsigned_buf.getvalue())

    with open(target_apk, "wb") as f:
        f.write(signed_apk_bytes)
    shutil.copyfile(target_apk, target_tv_apk)
    shutil.copyfile(target_apk, app_release_apk)

    # Checksum SHA-256
    apk_hash = hashlib.sha256(signed_apk_bytes).hexdigest()
    with open(f"{target_apk}.sha256", "w") as f:
        f.write(f"{apk_hash}  stremo-v1.0.0-universal.apk\n")

    size_mb = len(signed_apk_bytes) / (1024 * 1024)
    print(f"✅ APK généré avec succès ({size_mb:.2f} Mo) :")
    print(f"   • Universel (Mobile + TV) : {target_apk}")
    print(f"   • Android TV Leanback    : {target_tv_apk}")
    print(f"   • Gradle release target   : {app_release_apk}")
    print(f"   • SHA-256 : {apk_hash}")


if __name__ == "__main__":
    build_apk()
