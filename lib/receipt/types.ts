export type ParsedReceiptItem = {
  name: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
  category: string | null;
  source_text: string | null;
  confidence: number;
};

export type ParsedReceiptPayload = {
  merchant_name: string | null;
  expense_title: string;
  expense_date: string | null;
  original_currency: string;
  subtotal: number | null;
  tax: number;
  tip: number;
  fees: number;
  discount: number;
  total: number;
  items: ParsedReceiptItem[];
  warnings: string[];
};

export type ReceiptReviewItem = ParsedReceiptItem & {
  id: string;
  sort_order: number;
};

export type ReceiptReconciliation = {
  itemsSum: number;
  expectedTotal: number;
  reportedTotal: number;
  delta: number;
  matches: boolean;
};
