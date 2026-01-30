'use client'

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function TesteAuth() {
  const [status, setStatus] = useState("🔍 Testando sessão...")

  useEffect(() => {
    async function check() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (data.session) {
          setStatus("✅ Sessão encontrada!")
        } else {
          setStatus("⚠️ Nenhuma sessão ativa")
        }
      } catch (err) {
        setStatus("❌ Erro: " + err.message)
      }
    }
    check()
  }, [])

  return (
    <div style={{ 
      height: "100vh", 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      fontSize: "22px", 
      color: "#2563eb" 
    }}>
      {status}
    </div>
  )
}
