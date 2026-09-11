import { NextRequest, NextResponse } from "next/server";
import { importCsv, CsvRejectedError } from "@/lib/csvImport";

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Le fichier doit avoir l'extension .csv." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const report = importCsv(buffer);
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof CsvRejectedError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: `Erreur inattendue lors de l'import : ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
