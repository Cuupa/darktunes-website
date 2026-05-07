import { InstagramLogo, YoutubeLogo, SpotifyLogo } from '@phosphor-icons/react'

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">dT</span>
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight uppercase">darkTunes</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Music Group</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              We don't follow trends—we create them.
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider">Quick Links</h4>
            <nav className="flex flex-col gap-2">
              <a href="#artists" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                Artists
              </a>
              <a href="#releases" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                Releases
              </a>
              <a href="#news" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                News
              </a>
              <a href="#videos" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                Videos
              </a>
            </nav>
          </div>

          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider">Follow Us</h4>
            <div className="flex gap-3">
              <a
                href="https://instagram.com/darktunes"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <InstagramLogo size={24} weight="fill" />
              </a>
              <a
                href="https://youtube.com/@darktunes"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <YoutubeLogo size={24} weight="fill" />
              </a>
              <a
                href="https://open.spotify.com/user/darktunes"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <SpotifyLogo size={24} weight="fill" />
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} darkTunes Music Group. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-accent transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-accent transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-accent transition-colors">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
