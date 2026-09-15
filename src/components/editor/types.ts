export interface EditorSource {
  index: number;
  reference: string;
}

export interface RichTextEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxLength?: number;
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  sources?: readonly EditorSource[];
  id?: string;
  toolbarOffset?: "header" | "none";
}
