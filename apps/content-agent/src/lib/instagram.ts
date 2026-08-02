const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0'

export type PublishResult = {
  mediaId: string
}

export async function publishImage(
  accessToken: string,
  igUserId: string,
  imageUrl: string,
  caption: string
): Promise<PublishResult> {
  if (process.env.PUBLISH_MODE !== 'live') {
    return { mediaId: `draft-mode-${Date.now()}` }
  }

  const createResponse = await fetch(
    `${GRAPH_API_BASE}/${igUserId}/media?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption }),
    }
  )

  if (!createResponse.ok) {
    throw new Error(`Instagram media oluşturma başarısız: ${await createResponse.text()}`)
  }

  const { id: creationId } = await createResponse.json()

  const publishResponse = await fetch(
    `${GRAPH_API_BASE}/${igUserId}/media_publish?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId }),
    }
  )

  if (!publishResponse.ok) {
    throw new Error(`Instagram yayınlama başarısız: ${await publishResponse.text()}`)
  }

  const { id: mediaId } = await publishResponse.json()
  return { mediaId }
}

export async function refreshLongLivedToken(
  currentToken: string
): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`
  )

  if (!response.ok) {
    throw new Error(`Token yenileme başarısız: ${await response.text()}`)
  }

  const data = await response.json()
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in }
}
