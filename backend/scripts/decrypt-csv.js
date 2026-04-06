const fs = require("fs");
const crypto = require("crypto");

function usage() {
  // eslint-disable-next-line no-console
  console.log("Usage: node scripts/decrypt-csv.js <input.csv.enc> <output.csv> <password>");
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  const password = String(process.argv[4] || "");

  if (!inputPath || !outputPath || !password) {
    usage();
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(inputPath);
  const firstBreak = fileBuffer.indexOf(0x0a);
  if (firstBreak === -1) {
    throw new Error("Invalid encrypted CSV file format.");
  }

  const header = fileBuffer.slice(0, firstBreak).toString("utf8").trim();
  if (header !== "NEXSPEND_CSV_ENC_V1") {
    throw new Error("Unsupported encrypted CSV format header.");
  }

  const secondBreak = fileBuffer.indexOf(0x0a, firstBreak + 1);
  if (secondBreak === -1) {
    throw new Error("Encrypted CSV metadata is missing.");
  }

  const metadataLine = fileBuffer.slice(firstBreak + 1, secondBreak).toString("utf8").trim();
  const metadata = JSON.parse(metadataLine);

  if (!metadata || metadata.format !== "NEXSPEND_CSV_ENC_V1") {
    throw new Error("Encrypted CSV metadata is invalid.");
  }

  const ciphertext = fileBuffer.slice(secondBreak + 1);
  const salt = Buffer.from(metadata.salt, "base64");
  const iv = Buffer.from(metadata.iv, "base64");
  const tag = Buffer.from(metadata.tag, "base64");
  const key = crypto.scryptSync(password, salt, 32);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  fs.writeFileSync(outputPath, plaintext);

  // eslint-disable-next-line no-console
  console.log("Decrypted CSV written to: " + outputPath);
}

try {
  main();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error("Failed to decrypt CSV:", error.message);
  process.exit(1);
}
