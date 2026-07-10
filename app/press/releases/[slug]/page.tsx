export const dynamic = 'force-dynamic'

import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPressReleaseBySlug } from '@/lib/api/pressReleases'
import { PressReleaseDetailClient } from './_components/PressReleaseDetailClient'
import { buildPressArticleSchema, serializeJsonLd } from '@/lib/seo/jsonld'
import { getMetadataBrand } from '@/lib/seo/metadata'

const getPost = cache(async (slug: string) => {
  const supabase = await createServerSupabaseClient()
  return getPressReleaseBySlug(supabase, slug).catch(() => null)
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  return { title: post?.title ?? 'Press Release' }
}

export default async function PressReleaseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [post, brand] = await Promise.all([getPost(slug), getMetadataBrand()])
  if (!post) notFound()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            buildPressArticleSchema({ post, publisherName: brand.labelName }),
          ),
        }}
      />
      <PressReleaseDetailClient post={post} />
    </>
  )
}