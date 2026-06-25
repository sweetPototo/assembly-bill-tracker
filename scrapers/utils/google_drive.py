"""
PDF 저장 및 Google Drive 업로드 모듈
======================================
자바 개발자 관점:
  이 파일이 PdfService.java + DriveService.java 역할입니다.
  crawler.py 에서 from pdf_uploader import save_and_upload 로 호출합니다.

외부 의존성:
  pip install fpdf2 google-auth-oauthlib google-api-python-client

Google Drive 최초 실행 준비물:
  credentials.json 파일을 이 프로젝트 폴더에 넣어야 합니다.
  (Google Cloud Console > OAuth 2.0 클라이언트 ID > 데스크톱 앱 > JSON 다운로드)
  최초 실행 시 브라우저 인증창이 열리고, 이후 token.json 이 자동 생성됩니다.
"""

import io
import os
import re
from datetime import datetime

from fpdf import FPDF
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

# ==============================================================================
# [설정 영역]
# ==============================================================================

# Google Drive API 접근 권한 범위
# 'drive.file' = 이 앱이 만든 파일만 접근 (최소 권한 원칙)
SCOPES = ["https://www.googleapis.com/auth/drive.file"]

# Google Drive 최상위 보관 폴더 이름
DRIVE_ROOT_FOLDER = "뉴스 아카이브"

# 한글 폰트 경로 (맑은 고딕 — 한국어 Windows에 기본 내장)
KOREAN_FONT_PATH = r"C:\Windows\Fonts\malgun.ttf"


# ==============================================================================
# [내부 유틸] 파일명 생성 — 자바의 private static String buildFileName() 역할
# ==============================================================================

def _build_filename(article: dict) -> str:
    """
    "YYYYmmDD_기사제목_언론사.pdf" 형식의 파일명을 생성합니다.
    파일명에 사용 불가한 특수문자는 제거합니다.

    [자바 비교]
      re.sub(pattern, repl, string)  →  string.replaceAll(regex, repl)
      str[:40]                       →  str.substring(0, Math.min(40, str.length()))
    """
    today = datetime.now().strftime("%Y%m%d")

    # 파일명 불가 문자 제거: \ / * ? : " < > |
    # 자바: title.replaceAll("[\\\\/*?:\"<>|]", "")
    def sanitize(text: str) -> str:
        return re.sub(r'[\\/*?:"<>|]', "", text).strip()

    safe_title = sanitize(article.get("title", "제목없음"))[:40]
    safe_media = sanitize(article.get("media_name", "알수없음"))[:10]

    return f"{today}_{safe_title}_{safe_media}.pdf"


# ==============================================================================
# [1단계] PDF 생성 — 자바의 PdfService.createPdf(Article article) 역할
# ==============================================================================

def create_pdf(article: dict) -> bytes:
    """
    기사 딕셔너리를 받아 PDF를 메모리에서 생성하고 bytes로 반환합니다.
    디스크에 저장하지 않습니다.
    """
    today_str = datetime.now().strftime("%Y년 %m월 %d일")

    pdf = FPDF()
    pdf.set_margins(left=15, top=15, right=15)
    pdf.add_page()
    pdf.add_font("Malgun", fname=KOREAN_FONT_PATH)

    # --- 제목 ---
    pdf.set_font("Malgun", size=16)
    pdf.multi_cell(0, 10, article.get("title", ""), align="L")
    pdf.ln(3)

    # --- 메타 정보 ---
    pdf.set_font("Malgun", size=9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, f"언론사: {article.get('media_name', '')}   |   날짜: {today_str}",
             new_x="LMARGIN", new_y="NEXT")
    pdf.multi_cell(0, 6, f"URL: {article.get('url', '')}", align="L")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(3)

    # --- 구분선 ---
    pdf.set_draw_color(180, 180, 180)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(5)

    # --- AI 요약 ---
    pdf.set_font("Malgun", size=11)
    pdf.cell(0, 8, "[ AI 3줄 요약 ]", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Malgun", size=10)
    pdf.multi_cell(0, 7, article.get("summary", "요약 없음"), align="L")
    pdf.ln(4)

    # --- 구분선 ---
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(5)

    # --- 원본 본문 ---
    pdf.set_font("Malgun", size=11)
    pdf.cell(0, 8, "[ 원본 기사 본문 ]", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Malgun", size=9)
    pdf.multi_cell(0, 6, article.get("content", ""), align="L")

    return pdf.output()


# ==============================================================================
# [2단계] Google Drive 인증 — 자바의 DriveAuthService.getService() 역할
# ==============================================================================

def _get_drive_service():
    """
    Google Drive API 서비스 객체를 반환합니다.
    - 최초 실행: 브라우저 인증창 열림 → token.json 자동 저장
    - 이후 실행: token.json 에서 자격증명 재사용 (자동 갱신 포함)

    [자바 비교]
      token.json  →  세션 토큰을 파일로 캐싱하는 것과 유사
      creds.refresh(Request())  →  만료된 AccessToken을 RefreshToken으로 갱신
    """
    creds = None

    # 저장된 토큰이 있으면 불러옵니다.
    _dir = os.path.dirname(os.path.abspath(__file__))
    token_path = os.path.join(_dir, "..", "config", "token.json")
    credentials_path = os.path.join(_dir, "..", "config", "credentials.json")

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    # 토큰이 없거나 만료됐으면 재인증합니다.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            # 리프레시 토큰으로 액세스 토큰 자동 갱신
            creds.refresh(Request())
        else:
            # 최초 실행: 브라우저 OAuth 인증창
            if not os.path.exists(credentials_path):
                raise FileNotFoundError(
                    "scrapers/config/credentials.json 파일이 없습니다.\n"
                    "Google Cloud Console에서 OAuth 클라이언트 ID를 생성하고\n"
                    "scrapers/config/credentials.json 으로 저장하세요."
                )
            flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
            creds = flow.run_local_server(port=0)

        # 인증 토큰 로컬 저장 (다음 실행부터 재사용)
        with open(token_path, "w") as f:
            f.write(creds.to_json())

    return build("drive", "v3", credentials=creds)


# ==============================================================================
# [3단계] Drive 폴더 관리 — 자바의 DriveFolderService.getOrCreate() 역할
# ==============================================================================

def _get_or_create_folder(service, folder_name: str, parent_id: str = None) -> str:
    """
    Google Drive에 폴더가 있으면 ID를 반환하고, 없으면 새로 만든 뒤 ID를 반환합니다.

    [자바 비교]
      service.files().list(q=query).execute()  →  driveClient.searchFiles(query)
      결과 없으면 create() 호출               →  findOrElseCreate() 패턴
    """
    # 검색 조건: 이름 일치 + 폴더 타입 + 휴지통 아님
    query = (
        f"name='{folder_name}' "
        f"and mimeType='application/vnd.google-apps.folder' "
        f"and trashed=false"
    )
    if parent_id:
        query += f" and '{parent_id}' in parents"

    results = service.files().list(q=query, fields="files(id)").execute()
    existing = results.get("files", [])

    if existing:
        return existing[0]["id"]

    # 없으면 새 폴더 생성
    metadata = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if parent_id:
        metadata["parents"] = [parent_id]

    folder = service.files().create(body=metadata, fields="id").execute()
    print(f"  [Drive] 새 폴더 생성: {folder_name}")
    return folder["id"]


# ==============================================================================
# [4단계] Google Drive 업로드 — 자바의 DriveUploadService.upload() 역할
# ==============================================================================

def upload_to_drive(pdf_bytes: bytes, filename: str) -> str:
    """
    PDF bytes를 Google Drive의 날짜별 폴더에 직접 업로드합니다.
    로컬 파일을 거치지 않습니다.

    Drive 폴더 구조:
      뉴스 아카이브/
        └── 20260619/
              └── 20260619_기사제목_언론사.pdf

    반환값: 업로드된 파일의 Drive 파일 ID
    """
    service = _get_drive_service()
    today = datetime.now().strftime("%Y%m%d")

    root_id = _get_or_create_folder(service, DRIVE_ROOT_FOLDER)
    date_folder_id = _get_or_create_folder(service, today, parent_id=root_id)

    file_metadata = {
        "name": filename,
        "parents": [date_folder_id],
    }
    media = MediaIoBaseUpload(io.BytesIO(pdf_bytes), mimetype="application/pdf", resumable=True)
    uploaded = service.files().create(
        body=file_metadata,
        media_body=media,
        fields="id, name",
    ).execute()

    return uploaded["id"]


# ==============================================================================
# [퍼사드] 외부에서 호출하는 단일 진입점 — crawler.py 에서 이것만 import합니다.
# ==============================================================================

def save_and_upload(article: dict) -> None:
    """
    PDF를 메모리에서 생성해 Google Drive에 바로 업로드합니다.
    로컬 디스크를 거치지 않습니다.
    """
    try:
        pdf_bytes = create_pdf(article)
        filename = _build_filename(article)

        print(f"  [Drive] 업로드 중...")
        file_id = upload_to_drive(pdf_bytes, filename)
        print(f"  [Drive] 업로드 완료 (파일 ID: {file_id})")

    except FileNotFoundError as e:
        print(f"  [오류] {e}")
    except Exception as e:
        print(f"  [오류] PDF 업로드 실패: {e}")
