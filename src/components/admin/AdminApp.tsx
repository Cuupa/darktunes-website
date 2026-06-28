'use client'
import { useTranslations } from 'next-intl'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuthContext } from '@/contexts/AuthContext'
import { LoginForm } from './LoginForm'
import { AdminDashboard } from './AdminDashboard'
import { Card, CardContent } from '@/components/ui/card'
import { isSupabaseConfigured } from '@/env'

function AdminContent() {
  const t = useTranslations('admin.setup')
  const { loading, isAuthenticated } = useAuthContext()

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg">
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-2xl font-bold text-center">{t('supabaseUnavailableTitle')}</h2>
            <p className="text-muted-foreground text-center">
              {t('supabaseUnavailableDescription')}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginForm />
  }

  return <AdminDashboard />
}

export function AdminApp() {
  return (
    <AuthProvider>
      <AdminContent />
    </AuthProvider>
  )
}
