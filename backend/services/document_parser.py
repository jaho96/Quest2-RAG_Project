import os
import zlib
import struct
import zipfile
from pypdf import PdfReader
from docx import Document


def parse_file(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return _parse_pdf(file_path)
    elif ext == ".txt":
        return _parse_txt(file_path)
    elif ext == ".docx":
        return _parse_docx(file_path)
    elif ext == ".hwp":
        return _parse_hwp(file_path)
    elif ext == ".hwpx":
        return _parse_hwpx(file_path)
    else:
        raise ValueError(f"지원하지 않는 파일 형식입니다: {ext}")


def _parse_pdf(file_path: str) -> str:
    reader = PdfReader(file_path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _parse_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def _parse_docx(file_path: str) -> str:
    doc = Document(file_path)
    return "\n".join(para.text for para in doc.paragraphs if para.text.strip())


def _parse_hwp(file_path: str) -> str:
    """HWP 파일에서 텍스트 추출 (OLE 구조 파싱)"""
    import olefile

    try:
        ole = olefile.OleFileIO(file_path)
    except Exception:
        raise ValueError("HWP 파일을 읽을 수 없습니다. 파일이 손상됐거나 암호화된 파일일 수 있습니다.")

    texts = []
    section_idx = 0

    while True:
        section_name = f"BodyText/Section{section_idx}"
        if not ole.exists(section_name):
            break

        data = ole.openstream(section_name).read()

        # 압축 해제
        try:
            data = zlib.decompress(data, -15)
        except Exception:
            pass

        # 텍스트 레코드 파싱
        pos = 0
        while pos + 4 <= len(data):
            header = struct.unpack_from("<I", data, pos)[0]
            tag_id = header & 0x3FF
            size = (header >> 20) & 0xFFF
            pos += 4

            if size == 0xFFF:
                if pos + 4 <= len(data):
                    size = struct.unpack_from("<I", data, pos)[0]
                    pos += 4

            if tag_id == 67:  # HWPTAG_PARA_TEXT
                try:
                    text = data[pos : pos + size].decode("utf-16-le", errors="ignore")
                    if text.strip():
                        texts.append(text)
                except Exception:
                    pass

            pos += size

        section_idx += 1

    if not texts:
        raise ValueError("HWP 파일에서 텍스트를 추출할 수 없습니다.")

    return "\n".join(texts)


def _parse_hwpx(file_path: str) -> str:
    """HWPX 파일에서 텍스트 추출 (ZIP + XML 구조)"""
    import xml.etree.ElementTree as ET

    texts = []

    try:
        with zipfile.ZipFile(file_path, "r") as z:
            # HWPX는 Contents/section*.xml 에 본문 저장
            section_files = sorted(
                [f for f in z.namelist() if f.startswith("Contents/section") and f.endswith(".xml")]
            )

            for section_file in section_files:
                xml_data = z.read(section_file).decode("utf-8", errors="ignore")
                root = ET.fromstring(xml_data)

                # 모든 텍스트 노드 추출
                for elem in root.iter():
                    if elem.text and elem.text.strip():
                        texts.append(elem.text.strip())

    except Exception as e:
        raise ValueError(f"HWPX 파일을 읽을 수 없습니다: {e}")

    if not texts:
        raise ValueError("HWPX 파일에서 텍스트를 추출할 수 없습니다.")

    return "\n".join(texts)


def split_into_chunks(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """텍스트를 일정 크기의 청크로 분할 (overlap으로 문맥 유지)"""
    chunks = []
    start = 0
    text = text.strip()

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        if end < len(text):
            last_period = max(chunk.rfind("."), chunk.rfind("\n"))
            if last_period > chunk_size // 2:
                end = start + last_period + 1
                chunk = text[start:end]

        if chunk.strip():
            chunks.append(chunk.strip())

        start = end - overlap

    return chunks
