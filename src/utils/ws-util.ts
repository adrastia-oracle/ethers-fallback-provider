import { WebSocketProvider } from "@ethersproject/providers";

export const isWebSocketProvider = (provider: any) => {
  return provider instanceof WebSocketProvider || !!provider._websocket // Could be a different instance of ethers.
}
