export interface AuditEntry {
 id: string;
 actor: string;
 action: string;
 entity_type: string;
 entity_id: string;
 meta?: string;
 created_at: string;
}

export interface FaqEntry {
 id: string;
 title_en: string;
 title_hi: string;
 body_en: string;
 body_hi: string;
 active: boolean;
 created_at: string;
 updated_at?: string;
}
