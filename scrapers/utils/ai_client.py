"""
OpenAI API 통신 모듈
====================
목적별 프롬프트 설정(PromptConfig)을 분리하고,
단일 call_openai() 함수로 모든 AI 호출을 처리합니다.

새 프롬프트 추가 방법:
  1. PromptConfig 인스턴스를 모듈 하단 "프롬프트 정의" 영역에 추가
  2. crawler.py 등 호출부에서 call_openai(title, content, MY_CONFIG) 형태로 사용
"""

import os
import json
from dataclasses import dataclass
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

_API_KEY      = os.environ.get("OPENAI_API_KEY", "YOUR_API_KEY_HERE")
DEFAULT_MODEL = "gpt-4o"


# ==============================================================================
# PromptConfig — 프롬프트 단위 설정 컨테이너
# ==============================================================================

@dataclass
class PromptConfig:
    label:         str
    system:        str
    user_template: str
    model:         str = DEFAULT_MODEL
    content_limit: int = 3000
    json_mode:     bool = True   # False이면 JSON 파싱 없이 텍스트 문자열 반환


# ==============================================================================
# 프롬프트 정의 — 새 프롬프트는 여기에 추가
# ==============================================================================

DOMESTIC_NEWS = PromptConfig(
    label="국내뉴스 분석",
    system=(
        "당신은 대한민국 정치·사회 뉴스를 정밀 분석하는 팩트체크 전문 AI입니다.\n"
        "반드시 원본 기사에 명시된 객관적 사실만 사용하십시오.\n"
        "'심각한', '충격적인' 같은 주관적·감정적 형용사는 절대 사용하지 마십시오.\n\n"
        "[태스크 1 - 4줄 인사이트 요약]\n"
        "Fact(핵심 사건), Detail(수치·발언), Background(배경·맥락), Insight(파급효과) "
        "구조에 맞춰 정확히 4개의 한국어 문장 리스트를 생성하십시오.\n\n"
        "[태스크 2 - 분류 키워드 도출]\n"
        "기사의 핵심 주제를 대표하는 키워드 1~2개를 도출하십시오.\n"
        "허용 기준: 언론사 섹션명 또는 학술 데이터베이스 색인어로 사용 가능한 "
        "정제된 단독 명사형 단어만 허용합니다.\n"
        "금지 기준: '이해상충', '권력남용', '정치보복'처럼 "
        "비유적 표현·관용어·동사성 합성어는 절대 사용하지 마십시오.\n"
        "예시: '탄핵', '대선', '한미관계', '반도체', '국회', '검찰', '부동산', '안보'\n\n"
        "반드시 아래 JSON 형식으로만 출력하십시오:\n"
        '{"summary": ["Fact 문장", "Detail 문장", "Background 문장", "Insight 문장"], '
        '"context_keywords": ["키워드1", "키워드2"]}'
    ),
    user_template="다음 기사를 분석해 주세요.\n\n제목: {title}\n\n본문:\n{content}",
)

FOREIGN_NEWS = PromptConfig(
    label="BBC 외신 분석+번역",
    system=(
        "당신은 국제정치학 전문 팩트체크 AI입니다.\n"
        "원본 기사의 객관적 사실만 사용하고 주관적·감정적 형용사는 절대 금지합니다.\n"
        "현장 묘사나 지엽적 인터뷰는 제외하고 핵심 팩트·갈등 원인·지정학적 영향에 집중하십시오.\n\n"
        "[태스크 1 - 제목 번역]\n"
        "영문 제목을 자연스러운 한국어로 번역하십시오.\n\n"
        "[태스크 2 - 4줄 인사이트 요약]\n"
        "Fact(핵심 사건), Detail(수치·발언), Background(배경·맥락), Insight(지정학적 파급효과) "
        "구조에 맞춰 정확히 4개의 한국어 문장 리스트를 생성하십시오.\n\n"
        "[태스크 3 - 분류 키워드 도출]\n"
        "기사의 핵심 주제를 대표하는 키워드 1~2개를 도출하십시오.\n"
        "허용 기준: 언론사 섹션명 또는 학술 데이터베이스 색인어로 사용 가능한 "
        "정제된 단독 명사형 단어만 허용합니다.\n"
        "금지 기준: 비유적 표현·관용어·동사성 합성어는 절대 사용하지 마십시오.\n"
        "예시: '미중관계', '반도체', '핵억제', '대만해협', '인도태평양', '경제제재', '군사동맹'\n\n"
        "반드시 아래 JSON 형식으로만 출력하십시오:\n"
        '{"title_ko": "번역된 한국어 제목", '
        '"summary": ["Fact 문장", "Detail 문장", "Background 문장", "Insight 문장"], '
        '"context_keywords": ["키워드1", "키워드2"]}'
    ),
    user_template="다음 BBC 기사를 분석해 주세요.\n\n제목: {title}\n\n본문:\n{content}",
)

ASSEMBLY_BILL = PromptConfig(
    label="국회 법률안 요약",
    system=(
        "너는 대한민국 국회 법률안을 일반 국민이 이해하기 쉽게 요약하는 AI이다.\n\n"
        "다음 규칙을 따른다.\n\n"
        "- 제공된 내용만 사용한다.\n"
        "- 사실을 추측하지 않는다.\n"
        "- 정치적 의견이나 가치판단을 하지 않는다.\n"
        "- 쉬운 표현을 사용한다.\n"
        "- 지정된 출력 형식을 반드시 따른다.\n"
        "- 제공된 내용을 대표하는 카테고리를 반드시 아래 중 하나만 선택한다.\n"
        "[카테고리]\n"
        "경제\n"
        "노동\n"
        "교육\n"
        "복지\n"
        "환경\n"
        "국방\n"
        "외교\n"
        "산업\n"
        "과학기술\n"
        "교통\n"
        "금융\n"
        "부동산\n"
        "의료\n"
        "문화\n"
        "행정\n"
        "사법\n"
        "미분류"
    ),
    user_template=(
        "다음은 대한민국 국회에 발의된 법률안의 제안이유 및 주요내용입니다.\n\n"
        "{content}\n\n"
        "다음 형식으로 요약하세요.\n\n"
        "① 발의 이유\n② 핵심 내용\n③ 기대되는 효과\n④ 고려해야 할 점\n"
        "조건\n"
        "- 각 항목은 한 문장\n"
        "- 법안 내용만 근거로 작성\n"
        "- 효과와 고려사항은 가능성을 표현\n\n"
        "제안이유 및 주요내용을 대표하는 카테고리를 선택하세요.\n"
        "반드시 아래 JSON 형식으로만 반환하세요.\n"
        '{{"reason": "발의이유", "summary": "핵심내용", "benefit": "기대효과", "consideration": "고려사항", "category":"카테고리"}}'
    ),
    content_limit=5000,
    json_mode=True,
)

ASSEMBLY_CATEGORY_BILL = PromptConfig(
    label="국회 법률안 카테고리 설정",
    system=(
        "너는 대한민국 국회 법률안을 일반 국민이 이해하기 쉽게 요약하는 AI이다.\n\n"
        "다음 규칙을 따른다.\n\n"
        "- 제공된 내용만 사용한다.\n"
        "- 사실을 추측하지 않는다.\n"
        "- 제공된 내용을 대표하는 카테고리를 반드시 아래 중 하나만 선택한다.\n"
        "[카테고리]\n"
        "경제\n"
        "노동\n"
        "교육\n"
        "복지\n"
        "환경\n"
        "국방\n"
        "외교\n"
        "산업\n"
        "과학기술\n"
        "교통\n"
        "금융\n"
        "부동산\n"
        "의료\n"
        "문화\n"
        "행정\n"
        "사법"
    ),
    user_template=(
        "다음은 대한민국 국회에 발의된 법률안의 제안이유 및 주요내용입니다.\n\n"
        "{content}\n\n"
        "제안이유 및 주요내용을 대표하는 카테고리를 선택하세요.\n"
        "반드시 아래 JSON 형식으로만 반환하세요.\n"
        '{{"category":"카테고리"}}'
    ),
    content_limit=5000,
    json_mode=True,
)


# ==============================================================================
# 공통 호출 함수
# ==============================================================================

def call_openai(title: str, content: str, prompt: PromptConfig) -> dict | str | None:
    if _API_KEY == "YOUR_API_KEY_HERE":
        print("  [건너뜀] OPENAI_API_KEY가 설정되지 않았습니다.")
        return None

    print(f"  [AI] {prompt.label} GPT 요청 중...")
    client = OpenAI(api_key=_API_KEY)

    kwargs = dict(
        model=prompt.model,
        messages=[
            {"role": "system", "content": prompt.system},
            {"role": "user",   "content": prompt.user_template.format(
                title=title,
                content=content[:prompt.content_limit],
            )},
        ],
        temperature=0.0,
    )
    if prompt.json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    try:
        response = client.chat.completions.create(**kwargs)
        raw = response.choices[0].message.content
        if prompt.json_mode:
            return json.loads(raw)
        return raw

    except json.JSONDecodeError as e:
        print(f"  [오류] JSON 파싱 실패: {e}")
        return None
    except Exception as e:
        print(f"  [오류] OpenAI API 호출 실패: {e}")
        return None
