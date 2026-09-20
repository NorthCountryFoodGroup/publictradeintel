"use strict";
// Test-only retained storage. It is deliberately outside the witness SQLite recovery path.
const w=require("../../kronos/research-qualification-witness-contracts"),{openDisk}=require("../../kronos/research-qualification-witness-disk");
function openFakeVault(file,{mode="initialize-new",vaultId="fictional-vault"}={}){
 const disk=openDisk(file,{mode,metadata:{version:"KRONOS_FAKE_RETAINED_VAULT_V1",vaultId}});
 function records(){const data=disk.read();w.check(data.completed===data.entries.length,"VAULT_UNAVAILABLE");let previous=null;return data.entries.map((entry,i)=>{const receipt=w.seal({version:w.V.vault,vaultId,sequence:i+1,previousHash:previous,entryHash:w.hashValue(entry)},"receiptHash");previous=receipt.receiptHash;return {entry,receipt};});}
 return Object.freeze({
  latest(){const rows=records();return rows.length?structuredClone(rows.at(-1).receipt):null;},
  read(sequence){const row=records()[sequence-1];w.check(row,"VAULT_UNAVAILABLE");return structuredClone(row);},
  append(entry){const rows=records(),n=entry.receipt.sequence;w.check(Number.isSafeInteger(n)&&n>0,"VAULT_CONFLICT");
   if(n<=rows.length){w.check(w.canonicalize(entry)===w.canonicalize(rows[n-1].entry),"VAULT_CONFLICT");return structuredClone(rows[n-1].receipt);}
   w.check(n===rows.length+1&&entry.receipt.previousReceiptHash===(rows.at(-1)?.entry.receipt.receiptHash||null),"VAULT_CONFLICT");
   const sequence=disk.append(structuredClone(entry));disk.complete(sequence);return records().at(-1).receipt;
  },close:disk.close
 });
}
module.exports={openFakeVault};
