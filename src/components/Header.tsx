import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { List, X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { label: 'HOME', href: '#hero' },
    { label: 'ARTISTS', href: '#artists' },
    { label: 'RELEASES', href: '#releases' },
    { label: 'NEWS', href: '#news' },
    { label: 'VIDEOS', href: '#videos' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">dT</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase">darkTunes</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Music Group</p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Button
                key={item.label}
                variant="ghost"
                asChild
                className="text-sm font-medium tracking-wide hover:text-accent"
              >
                <a href={item.href}>{item.label}</a>
              </Button>
            ))}
            <Button className="ml-4 bg-accent text-accent-foreground hover:bg-accent/90 font-bold uppercase tracking-wider">
              Newsletter
            </Button>
          </nav>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <List size={24} />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-border overflow-hidden"
          >
            <nav className="container mx-auto px-4 py-6 flex flex-col gap-2">
              {navItems.map((item) => (
                <Button
                  key={item.label}
                  variant="ghost"
                  asChild
                  className="justify-start text-base font-medium tracking-wide hover:text-accent"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <a href={item.href}>{item.label}</a>
                </Button>
              ))}
              <Button className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90 font-bold uppercase tracking-wider">
                Newsletter
              </Button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
