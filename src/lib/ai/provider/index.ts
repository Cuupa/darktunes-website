export { AiProviderError, isAiProviderError } from '@/lib/ai/provider/errors'
export type { AiProvider } from '@/lib/ai/provider/interface'
export { NvidiaOpenAiCompatibleProvider, buildNvidiaPayload } from '@/lib/ai/provider/nvidia'
export { MockAiProvider } from '@/lib/ai/provider/mock'
export { resolveNvidiaApiKey, readNvidiaEnvKey } from '@/lib/ai/provider/resolveKey'
export {
  runNvidiaConnectionTest,
  CONNECTION_TEST_ECHO_TOOL,
} from '@/lib/ai/provider/connectionTest'
