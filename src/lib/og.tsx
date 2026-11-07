import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// 카톡·SNS 공유 미리보기 이미지 (1200×630). 빌드 때 한 번 그림. 기본 글꼴엔 한글이 없어서 Pretendard 를 넣음
export const OG_SIZE = { width: 1200, height: 630 };

const font = (w: string) => readFile(join(process.cwd(), `node_modules/pretendard/dist/public/static/alternative/Pretendard-${w}.ttf`));

export async function ogImage(title: string, sub: string) {
  const [bold, semi] = await Promise.all([font("Bold"), font("SemiBold")]);
  const icon = `data:image/png;base64,${(await readFile(join(process.cwd(), "public/icons/icon-192.png"))).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0c563b", color: "white", fontFamily: "Pretendard" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} width={72} height={72} style={{ borderRadius: 18 }} alt="" />
          <span style={{ fontSize: 40, fontWeight: 700 }}>공부방노트</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.25, wordBreak: "keep-all" }}>{title}</span>
          <span style={{ fontSize: 32, fontWeight: 600, color: "#c9a86a", wordBreak: "keep-all" }}>{sub}</span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
        { name: "Pretendard", data: semi, weight: 600, style: "normal" },
      ],
    },
  );
}
