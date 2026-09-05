import "server-only";import {readFile} from "node:fs/promises";import path from "node:path";
export async function loadEddyNotes(){try{return await readFile(path.join(process.cwd(),"knowledge/eddy-notes.md"),"utf8")}catch{return "No Eddy notes are currently available."}}
