const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0'

export type PublishResult = {
  mediaId: string
}

function redactAccessToken(message: string): string {
  return message.replace(/access_token=[^&\s"']+/g, 'access_token=REDACTED')
}

async function requestGraphApi(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    throw new Error(`Instagram API isteğinde ağ hatası: ${redactAccessToken((error as Error).message)}`)
  }
}

const CONTAINER_STATUS_MAX_ATTEMPTS = 10
const CONTAINER_STATUS_POLL_INTERVAL_MS = 2000

// Instagram, medya container'ını arka planda (görseli indirip işleyerek) hazırlar;
// status_code FINISHED olmadan media_publish çağrısı "media not ready" hatası verir.
async function waitForContainerReady(creationId: string, accessToken: string): Promise<void> {
  for (let attempt = 0; attempt < CONTAINER_STATUS_MAX_ATTEMPTS; attempt++) {
    const statusResponse = await requestGraphApi(
      `${GRAPH_API_BASE}/${creationId}?fields=status_code&access_token=${accessToken}`
    )

    if (!statusResponse.ok) {
      throw new Error(`Instagram media durum kontrolü başarısız: ${redactAccessToken(await statusResponse.text())}`)
    }

    const { status_code: statusCode } = await statusResponse.json()

    if (statusCode === 'FINISHED') {
      return
    }
    if (statusCode === 'ERROR') {
      throw new Error('Instagram media işleme hatası: status_code=ERROR')
    }

    await new Promise((resolve) => setTimeout(resolve, CONTAINER_STATUS_POLL_INTERVAL_MS))
  }

  throw new Error('Instagram media zaman aşımına uğradı: container hazır olmadı')
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

  const createResponse = await requestGraphApi(
    `${GRAPH_API_BASE}/${igUserId}/media?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption }),
    }
  )

  if (!createResponse.ok) {
    throw new Error(`Instagram media oluşturma başarısız: ${redactAccessToken(await createResponse.text())}`)
  }

  const { id: creationId } = await createResponse.json()

  await waitForContainerReady(creationId, accessToken)

  const publishResponse = await requestGraphApi(
    `${GRAPH_API_BASE}/${igUserId}/media_publish?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId }),
    }
  )

  if (!publishResponse.ok) {
    throw new Error(`Instagram yayınlama başarısız: ${redactAccessToken(await publishResponse.text())}`)
  }

  const { id: mediaId } = await publishResponse.json()
  return { mediaId }
}

export async function refreshLongLivedToken(
  currentToken: string
): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const response = await requestGraphApi(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`
  )

  if (!response.ok) {
    throw new Error(`Token yenileme başarısız: ${redactAccessToken(await response.text())}`)
  }

  const data = await response.json()
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in }
}
