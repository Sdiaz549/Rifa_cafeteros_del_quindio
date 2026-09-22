import { crc32 as zlibCrc32 } from 'node:zlib'
import { formatTicketNumber, ticketNumbersTable } from '../../shared/tickets/numbers'
import { formatCop } from '../../shared/money'

function crc32(data: Buffer): number {
  if (typeof zlibCrc32 === 'function') return zlibCrc32(data) >>> 0
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i]
    for (let b = 0; b < 8; b += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

const COLS = 8

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function zipStore(files: Array<{ path: string; data: Buffer }>): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const name = Buffer.from(file.path, 'utf8')
    const crc = crc32(file.data) >>> 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(file.data.length, 18)
    local.writeUInt32LE(file.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    const localFull = Buffer.concat([local, name, file.data])
    locals.push(localFull)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(file.data.length, 20)
    central.writeUInt32LE(file.data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(Buffer.concat([central, name]))
    offset += localFull.length
  }

  const localBlob = Buffer.concat(locals)
  const centralBlob = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBlob.length, 12)
  end.writeUInt32LE(localBlob.length, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([localBlob, centralBlob, end])
}

function cellXml(text: string, width = 1200, bold = false): string {
  const t = text
    ? `<w:t>${escapeXml(text)}</w:t>`
    : `<w:t xml:space="preserve"> </w:t>`
  const rPr = bold
    ? `<w:b/><w:sz w:val="22"/><w:szCs w:val="22"/>`
    : `<w:sz w:val="22"/><w:szCs w:val="22"/>`
  return `<w:tc>
      <w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
      <w:p>
        <w:pPr><w:jc w:val="center"/></w:pPr>
        <w:r><w:rPr>${rPr}</w:rPr>${t}</w:r>
      </w:p>
    </w:tc>`
}

function tableXml(rows: string, gridCols: number, colWidth: number): string {
  const grid = Array.from({ length: gridCols }, () => `<w:gridCol w:w="${colWidth}"/>`).join('')
  return `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="${gridCols * colWidth}" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>${grid}</w:tblGrid>
      ${rows}
    </w:tbl>`
}

function packDocx(documentXml: string): Buffer {
  return zipStore([
    {
      path: '[Content_Types].xml',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
        'utf8'
      )
    },
    {
      path: '_rels/.rels',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
        'utf8'
      )
    },
    {
      path: 'word/_rels/document.xml.rels',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
        'utf8'
      )
    },
    {
      path: 'word/document.xml',
      data: Buffer.from(documentXml, 'utf8')
    }
  ])
}

export function buildSellerTicketsDocx(sellerName: string, numbers: number[]): Buffer {
  const rows = ticketNumbersTable(numbers, COLS)
  const tableRows = rows
    .map((row) => `<w:tr>${row.map((cell) => cellXml(cell)).join('')}</w:tr>`)
    .join('')
  const table = rows.length === 0 ? '' : tableXml(tableRows, COLS, 1200)
  return packDocx(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
        <w:t>${escapeXml(sellerName)}</w:t>
      </w:r>
    </w:p>
    ${table}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/>
    </w:sectPr>
  </w:body>
</w:document>`)
}

export function buildSellerPaymentsDocx(
  sellerName: string,
  tickets: Array<{ number: number; totalPaid: number }>
): Buffer {
  const colW = 4800
  const sorted = [...tickets]
    .filter((t) => Number.isFinite(t.number) && t.number >= 0)
    .sort((a, b) => a.number - b.number)
  const body = sorted
    .map(
      (t) =>
        `<w:tr>${cellXml(formatTicketNumber(t.number), colW)}${cellXml(formatCop(t.totalPaid), colW)}</w:tr>`
    )
    .join('')
  const total = sorted.reduce((sum, t) => sum + (Number(t.totalPaid) || 0), 0)
  const header = `<w:tr>${cellXml('Boleta', colW, true)}${cellXml('Lleva', colW, true)}</w:tr>`
  const footer = `<w:tr>${cellXml('Total', colW, true)}${cellXml(formatCop(total), colW, true)}</w:tr>`
  const table = tableXml(`${header}${body}${footer}`, 2, colW)
  return packDocx(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
        <w:t>Relación de pagos</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
        <w:t>${escapeXml(sellerName)}</w:t>
      </w:r>
    </w:p>
    ${table}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/>
    </w:sectPr>
  </w:body>
</w:document>`)
}
