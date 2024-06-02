import { createPart } from "part-di";

export type DocumentApi = {
  serveCollection: () => void;
};

export const DocumentApi = createPart<DocumentApi>("DocumentApi");
