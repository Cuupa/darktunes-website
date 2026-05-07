import { Toaster } from 'sonner'
import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { Releases } from '@/components/Releases'
import { Artists } from '@/components/Artists'
import { News } from '@/components/News'
import { Videos } from '@/components/Videos'
import { Footer } from '@/components/Footer'
import { mockReleases, mockArtists, mockNews, mockVideos } from '@/lib/mockData'

function App() {
  const featuredRelease = mockReleases.find(r => r.featured) || mockReleases[0]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero featuredRelease={featuredRelease} />
        <Releases releases={mockReleases} />
        <Artists artists={mockArtists} />
        <News news={mockNews} />
        <Videos videos={mockVideos} />
      </main>
      <Footer />
      <Toaster position="bottom-right" theme="dark" />
    </div>
  )
}

export default App