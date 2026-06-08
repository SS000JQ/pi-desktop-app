import JSZip from 'jszip'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function columnName(index: number): string {
  let value = ''
  let current = index + 1
  while (current > 0) {
    const remainder = (current - 1) % 26
    value = String.fromCharCode(65 + remainder) + value
    current = Math.floor((current - 1) / 26)
  }
  return value
}

export async function createXlsxFixture(rows: string[][], sheetName = 'Sheet1'): Promise<Uint8Array> {
  const zip = new JSZip()
  const rowCount = Math.max(1, rows.length)
  const columnCount = Math.max(1, ...rows.map((row) => row.length))
  const dimension = `A1:${columnName(columnCount - 1)}${rowCount}`
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`
        })
        .join('')
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join('')

  zip.file(
    '[Content_Types].xml',
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
      '</Types>',
    ].join(''),
  )
  zip.file(
    '_rels/.rels',
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
      '</Relationships>',
    ].join(''),
  )
  zip.file(
    'xl/workbook.xml',
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      '<sheets>',
      `<sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>`,
      '</sheets>',
      '</workbook>',
    ].join(''),
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
      '</Relationships>',
    ].join(''),
  )
  zip.file(
    'xl/worksheets/sheet1.xml',
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      `<dimension ref="${dimension}"/>`,
      '<sheetData>',
      sheetRows,
      '</sheetData>',
      '</worksheet>',
    ].join(''),
  )

  return zip.generateAsync({ type: 'uint8array' })
}
