'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { List, X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import logoImage from '@/assets/images/logo_(1).png'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navItems = [
    { label: 'HOME', href: '#hero' },
    { label: 'ARTISTS', href: '#artists' },
    { label: 'RELEASES', href: '#releases' },
    { label: 'NEWS', href: '#news' },
    { label: 'VIDEOS', href: '#videos' },
  ]

  const handleSmoothScroll = (e: React.MouseEvent<HTMLElement>, href: string) => {
    e.preventDefault()
    const target = document.querySelector(href)
    if (target) {
      const headerOffset = 100
      const elementPosition = target.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border transition-all duration-300">
      <div className="container mx-auto px-4 lg:px-16">
        <div className={`flex items-center justify-between transition-all duration-300 ${scrolled ? 'h-20' : 'h-28 md:h-32'}`}>
          <motion.a 
            href="#hero"
            onClick={(e) => handleSmoothScroll(e, '#hero')}
            className="flex items-center"
            animate={{
              scale: scrolled ? 0.75 : 1,
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <img 
              src={logoImage} 
              alt="darkTunes Music Group" 
              className={`transition-all duration-300 ${scrolled ? 'h-12 md:h-14' : 'h-16 md:h-20'}`}
            />
          </motion.a>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Button
                key={item.label}
                variant="ghost"
                asChild
                className="text-sm font-medium tracking-wider hover:text-accent transition-colors"
              >
                <a href={item.href} onClick={(e) => handleSmoothScroll(e, item.href)}>{item.label}</a>
              </Button>
            ))}
            <Button className="ml-4 bg-accent text-accent-foreground hover:bg-accent/90 font-bold uppercase tracking-wider transition-all hover:scale-105">
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
            className="lg:hidden border-t border-border overflow-hidden bg-background/98 backdrop-blur-md"
          >
            <nav className="container mx-auto px-4 py-6 flex flex-col gap-2">
              {navItems.map((item) => (
                <Button
                  key={item.label}
                  variant="ghost"
                  className="justify-start text-base font-medium tracking-wider hover:text-accent"
                  onClick={(e) => {
                    handleSmoothScroll(e, item.href)
                    setMobileMenuOpen(false)
                  }}
                >
                  <a href={item.href} onClick={(e) => e.preventDefault()}>{item.label}</a>
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
