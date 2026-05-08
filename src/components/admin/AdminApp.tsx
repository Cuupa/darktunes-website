'use client'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuthContext } from '@/contexts/AuthContext'
import { LoginForm } from './LoginForm'
import { AdminDashboard } from './AdminDashboard'
import { Card, CardContent } from '@/components/ui/card'
import { isSupabaseConfigured } from '@/lib/supabase'

function AdminContent() {
  const { loading, isAuthenticated } = useAuthContext()

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg">
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-2xl font-bold text-center">Supabase Not Configured</h2>
            <p className="text-muted-foreground text-center">
              To use the admin features, please configure Supabase credentials in your environment variables.
            </p>
            <div className="bg-muted p-4 rounded-md font-mono text-sm">
              <p>Required environment variables:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>VITE_SUPABASE_URL</li>
                <li>VITE_SUPABASE_ANON_KEY</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              See DEPLOYMENT.md for detailed setup instructions.
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
