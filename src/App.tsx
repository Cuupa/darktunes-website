import { Toaster } from 'sonner'
import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { Releases } from '@/components/Releases'
import { Artists } from '@/components/Artists'
import { News } from '@/components/News'
import { Videos } from '@/components/Videos'
import { Footer } from '@/components/Footer'
import { CRTOverlay } from '@/components/CRTOverlay'
import { SpotifyPlayer } from '@/components/SpotifyPlayer'
import { mockArtists, mockNews, mockVideos } from '@/lib/mockData'
import { useItunesSync } from '@/hooks/useItunesSync'
import { Button } from '@/components/ui/button'
import { ArrowsClockwise } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

function App() {
  const { releases, isLoading, isSyncing, syncProgress, syncReleases } = useItunesSync()
  
  const featuredRelease = releases && releases.length > 0 
    ? releases.find(r => r.featured) || releases[0]
    : undefined

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <CRTOverlay />
      <Header />
      <main>
        <Hero featuredRelease={featuredRelease} />
        
        <section id="releases" className="relative">
          <div className="absolute top-8 right-8 z-10">
            <Button
              onClick={syncReleases}
              disabled={isSyncing}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <ArrowsClockwise 
                size={16} 
                className={isSyncing ? 'animate-spin' : ''} 
                weight="bold"
              />
              {isSyncing ? `Syncing ${syncProgress}%` : 'Sync iTunes'}
            </Button>
          </div>
          
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-24 px-4 lg:px-16 flex justify-center items-center"
              >
                <div className="text-center space-y-4">
                  <ArrowsClockwise size={48} className="animate-spin mx-auto text-primary" weight="bold" />
                  <p className="text-xl text-muted-foreground">Loading releases from iTunes...</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="releases"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Releases releases={releases || []} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section id="spotify-player" className="py-12 px-4 lg:px-16 bg-muted/30">
          <div className="container mx-auto max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-8 text-center"
            >
              <h2 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight">SPOTIFY</h2>
              <p className="text-lg text-muted-foreground font-serif">Listen to our playlist</p>
            </motion.div>
            <SpotifyPlayer playlistUri="37i9dQZF1DWWqNV5cS50j6" />
          </div>
        </section>
        
        <Artists artists={mockArtists} />
        <Videos videos={mockVideos} />
        <News news={mockNews} />
      </main>
      <Footer />
      <Toaster position="bottom-right" theme="dark" />
    </div>
  )
}

export default App