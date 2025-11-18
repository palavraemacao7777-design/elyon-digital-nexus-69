// Auto-generated Supabase types
// This file contains type definitions for Supabase tables and operations

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      checkouts: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string | null
          member_area_id: string | null
          name: string
          product_id: string | null
          price: number
          promotional_price: number | null
          offer_mode: string
          layout: string
          form_fields: Json
          payment_methods: Json
          order_bumps: Json
          styles: Json
          extra_content: Json
          support_contact: Json
          integrations: Json
          timer: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id?: string | null
          member_area_id?: string | null
          name: string
          product_id?: string | null
          price?: number
          promotional_price?: number | null
          offer_mode?: string
          layout?: string
          form_fields?: Json
          payment_methods?: Json
          order_bumps?: Json
          styles?: Json
          extra_content?: Json
          support_contact?: Json
          integrations?: Json
          timer?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id?: string | null
          member_area_id?: string | null
          name?: string
          product_id?: string | null
          price?: number
          promotional_price?: number | null
          offer_mode?: string
          layout?: string
          form_fields?: Json
          payment_methods?: Json
          order_bumps?: Json
          styles?: Json
          extra_content?: Json
          support_contact?: Json
          integrations?: Json
          timer?: Json | null
        }
      }
      products: {
        Row: {
          id: string
          created_at: string
          user_id: string
          name: string
          description: string
          price: number
          banner_url: string | null
          logo_url: string | null
          access_url: string | null
          file_url: string | null
          member_area_link: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          name: string
          description: string
          price?: number
          banner_url?: string | null
          logo_url?: string | null
          access_url?: string | null
          file_url?: string | null
          member_area_link?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          name?: string
          description?: string
          price?: number
          banner_url?: string | null
          logo_url?: string | null
          access_url?: string | null
          file_url?: string | null
          member_area_link?: string | null
        }
      }
      member_areas: {
        Row: {
          id: string
          created_at: string
          user_id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          name?: string
          slug?: string
        }
      }
      platform_settings: {
        Row: {
          id: string
          colors: Json
          password_reset_subject: string
          password_reset_body: string
        }
        Insert: {
          id?: string
          colors?: Json
          password_reset_subject?: string
          password_reset_body?: string
        }
        Update: {
          id?: string
          colors?: Json
          password_reset_subject?: string
          password_reset_body?: string
        }
      }
      profiles: {
        Row: {
          user_id: string
          name: string
          email: string
          status: string
          created_at: string
          member_area_id: string
          avatar_url: string | null
          role: string | null
        }
        Insert: {
          user_id: string
          name: string
          email: string
          status: string
          created_at?: string
          member_area_id: string
          avatar_url?: string | null
          role?: string | null
        }
        Update: {
          user_id?: string
          name?: string
          email?: string
          status?: string
          created_at?: string
          member_area_id?: string
          avatar_url?: string | null
          role?: string | null
        }
      }
      member_access: {
        Row: {
          member_id: string
          product_id: string
        }
        Insert: {
          member_id: string
          product_id: string
        }
        Update: {
          member_id?: string
          product_id?: string
        }
      }
      members: {
        Row: {
          id: string
          user_id: string
        }
        Insert: {
          id: string
          user_id: string
        }
        Update: {
          id?: string
          user_id?: string
        }
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Custom types for checkout configuration
export interface DeliverableConfig {
  type: 'none' | 'link' | 'upload'
  link: string | null
  fileUrl: string | null
  name: string | null
  description: string | null
}

export interface GuaranteeConfig {
  enabled: boolean
  days: number
  description: string
}

export interface ReservedRightsConfig {
  enabled: boolean
  text: string
}

export interface PackageConfig {
  id: number
  name: string
  description: string
  topics: string[]
  price: number
  originalPrice: number
  mostSold: boolean
  associatedProductIds: string[]
}

export interface FormFields {
  requireName?: boolean
  requireEmail?: boolean
  requireEmailConfirm?: boolean
  requirePhone?: boolean
  requireCpf?: boolean
  packages?: PackageConfig[]
  deliverable?: DeliverableConfig
  sendTransactionalEmail?: boolean
  transactionalEmailSubject?: string
  transactionalEmailBody?: string
  guarantee?: GuaranteeConfig
  reservedRights?: ReservedRightsConfig
}

export interface CheckoutIntegrationsConfig {
  selectedMercadoPagoAccount?: string
  selectedMetaPixel?: string
  selectedEmailAccount?: string
}

export interface CheckoutStyles {
  backgroundColor?: string
  primaryColor?: string
  textColor?: string
  headlineText?: string
  headlineColor?: string
  description?: string
  gradientColor?: string
  highlightColor?: string
  logo_url?: string | null
  banner_url?: string | null
}
