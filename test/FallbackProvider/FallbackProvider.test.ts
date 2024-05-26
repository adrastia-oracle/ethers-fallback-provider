import {
  FallbackProvider,
  validateAndGetNetwork,
  FallbackProviderError,
} from "../../src/FallbackProvider";

import FailingProvider from "./helpers/FailingProvider";
import MockProvider from "./helpers/MockProvider";
import MockWebsocketProvider from "./helpers/MockWebsocketProvider";

describe("FallbackProvider", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("validateAndGetNetwork", () => {
    it("should throw an error if no provider is provided", async () => {
      await expect(validateAndGetNetwork([])).rejects.toThrowError(
        FallbackProviderError.NO_PROVIDER
      );
    });
    it("should throw an error if it cannot detect providers network", async () => {
      const provider1 = new MockProvider("1", 0);
      const provider2 = new MockProvider("2", 0);

      await expect(validateAndGetNetwork([provider1, provider2])).rejects.toThrowError(
        FallbackProviderError.CANNOT_DETECT_NETWORKS
      );
    });
    it("should throw an error if all providers are not connected to the same network", async () => {
      const provider1 = new MockProvider("1", 1);
      const provider2 = new MockProvider("2", 2);

      await expect(validateAndGetNetwork([provider1, provider2])).rejects.toThrowError(
        FallbackProviderError.INCONSISTENT_NETWORKS
      );
    });
    it("should return the providers' network and the list of available providers", async () => {
      const provider1 = new MockProvider("1", 1);
      const provider2 = new MockProvider("2", 0);
      const provider3 = new MockProvider("3", 1);

      const { network, providers } = await validateAndGetNetwork([provider1, provider2, provider3]);

      expect(network.chainId).toEqual(1);
      expect(providers).toHaveLength(2);
      expect(providers[0].provider).toEqual(provider1);
      expect(providers[1].provider).toEqual(provider3);
    });
  });

  describe("perform", () => {
    it("should return the first value if the first provider is successful", async () => {
      const provider1 = new MockProvider("1");
      const provider2 = new MockProvider("2");
      const provider = new FallbackProvider([provider1, provider2]);

      jest.spyOn(provider1, "perform");
      jest.spyOn(provider2, "perform");

      const res = await provider.perform("send", {});

      expect(provider1.perform).toHaveBeenCalledTimes(1);
      expect(provider2.perform).not.toHaveBeenCalled();
      expect(res).toEqual("1");
    });

    it("should return the second value if the first provider is failing", async () => {
      const provider1 = new FailingProvider("1");
      const provider2 = new MockProvider("2");
      const provider = new FallbackProvider([provider1, provider2]);

      jest.spyOn(provider1, "perform");
      jest.spyOn(provider2, "perform");

      const res = await provider.perform("send", {});

      expect(provider1.perform).toHaveBeenCalledTimes(1);
      expect(provider2.perform).toHaveBeenCalledTimes(1);
      expect(res).toEqual("2");
    });

    it("should fail if all providers are failing", async () => {
      const provider1 = new FailingProvider("1");
      const provider2 = new FailingProvider("2");
      const provider = new FallbackProvider([provider1, provider2]);

      jest.spyOn(provider1, "perform");
      jest.spyOn(provider2, "perform");

      await expect(provider.perform("send", {})).rejects.toThrowError("Failing provider used: 2");

      expect(provider1.perform).toHaveBeenCalledTimes(1);
      expect(provider2.perform).toHaveBeenCalledTimes(1);
    });

    it("should retry the first provider", async () => {
      const provider1 = new FailingProvider("1", 1);
      const provider2 = new FailingProvider("2");
      const provider = new FallbackProvider([{ provider: provider1, retries: 1 }, provider2]);

      jest.spyOn(provider1, "perform");
      jest.spyOn(provider2, "perform");

      const res = await provider.perform("send", {});

      expect(provider1.perform).toHaveBeenCalledTimes(2);
      expect(provider2.perform).not.toHaveBeenCalled();
      expect(res).toEqual("1");
    });
    it("should fallback after max retries reached", async () => {
      const provider1 = new FailingProvider("1", 2);
      const provider2 = new MockProvider("2");
      const provider = new FallbackProvider([{ provider: provider1, retries: 1 }, provider2]);

      jest.spyOn(provider1, "perform");
      jest.spyOn(provider2, "perform");

      const res = await provider.perform("send", {});

      expect(provider1.perform).toHaveBeenCalledTimes(2);
      expect(provider2.perform).toHaveBeenCalledTimes(1);
      expect(res).toEqual("2");
    });

    describe("Websocket providers", () => {
      it("should fallback if the websocket is closing", async () => {
        const provider1 = new MockWebsocketProvider("1");
        const provider2 = new MockProvider("2");
        const provider = new FallbackProvider([provider1, provider2]);

        jest.spyOn(provider1, "perform");
        jest.spyOn(provider2, "perform");

        provider1.setWsReadyState(2);

        const res = await provider.perform("send", {});

        expect(provider1.perform).not.toHaveBeenCalled();
        expect(provider2.perform).toHaveBeenCalledTimes(1);
        expect(res).toEqual("2");
      });

      it("should fallback if the websocket is closed", async () => {
        const provider1 = new MockWebsocketProvider("1");
        const provider2 = new MockProvider("2");
        const provider = new FallbackProvider([provider1, provider2]);

        jest.spyOn(provider1, "perform");
        jest.spyOn(provider2, "perform");

        provider1.setWsReadyState(3);

        const res = await provider.perform("send", {});

        expect(provider1.perform).not.toHaveBeenCalled();
        expect(provider2.perform).toHaveBeenCalledTimes(1);
        expect(res).toEqual("2");
      });

      it("should fallback if the websocket is not ready", async () => {
        const provider1 = new MockWebsocketProvider("1");
        const provider2 = new MockProvider("2");
        const provider = new FallbackProvider([provider1, provider2]);

        jest.spyOn(provider1, "perform");
        jest.spyOn(provider2, "perform");

        provider1.setWsReadyState(0);

        const res = await provider.perform("send", {});

        expect(provider1.perform).not.toHaveBeenCalled();
        expect(provider2.perform).toHaveBeenCalledTimes(1);
        expect(res).toEqual("2");
      });

      it("should not fallback if the websocket is ready", async () => {
        const provider1 = new MockWebsocketProvider("1");
        const provider2 = new MockProvider("2");
        const provider = new FallbackProvider([provider1, provider2]);

        jest.spyOn(provider1, "perform");
        jest.spyOn(provider2, "perform");

        provider1.setWsReadyState(1);

        const res = await provider.perform("send", {});

        expect(provider1.perform).toHaveBeenCalledTimes(1);
        expect(provider2.perform).not.toHaveBeenCalled();
        expect(res).toEqual("1");
      });

      it("should fallback if the websocket is connecting but then proceed with the ws provider when the fallback fails", async () => {
        const provider1 = new MockWebsocketProvider("1");
        const provider2 = new FailingProvider("2");
        const provider = new FallbackProvider([provider1, provider2]);

        jest.spyOn(provider1, "perform");
        jest.spyOn(provider2, "perform");

        // When perform is called on provider2, make provider1 ready.
        jest.spyOn(provider2, "perform").mockImplementationOnce(() => {
          provider1.setWsReadyState(1);
          return Promise.reject(new Error("Failed to perform"));
        });

        provider1.setWsReadyState(0);

        const res = await provider.perform("send", {});

        expect(provider1.perform).toHaveBeenCalledTimes(1);
        expect(provider2.perform).toHaveBeenCalledTimes(1);
        expect(res).toEqual("1");
      });

      it("should fallback if the websocket is closing, then fail when the fallback fails", async () => {
        const provider1 = new MockWebsocketProvider("1");
        const provider2 = new FailingProvider("2");
        const provider = new FallbackProvider([provider1, provider2]);

        provider1.setWsReadyState(2);

        jest.spyOn(provider1, "perform");
        jest.spyOn(provider2, "perform");

        await expect(provider.perform("send", {})).rejects.toThrowError("Failing provider used: 2");

        expect(provider1.perform).toHaveBeenCalledTimes(0); // Doesn't try performing since the ws is closing
        expect(provider2.perform).toHaveBeenCalledTimes(1);
      });

      it("should fallback if the websocket is closed, then fail when the fallback fails", async () => {
        const provider1 = new MockWebsocketProvider("1");
        const provider2 = new FailingProvider("2");
        const provider = new FallbackProvider([provider1, provider2]);

        provider1.setWsReadyState(3);

        jest.spyOn(provider1, "perform");
        jest.spyOn(provider2, "perform");

        await expect(provider.perform("send", {})).rejects.toThrowError("Failing provider used: 2");

        expect(provider1.perform).not.toHaveBeenCalled(); // Doesn't try performing since the ws is closing
        expect(provider2.perform).toHaveBeenCalledTimes(1);
      });

      it("should fallback if the websocket is forever connecting", async () => {
        const provider1 = new MockWebsocketProvider("1");
        const provider2 = new MockProvider("2");
        const provider = new FallbackProvider([provider1, provider2]);

        jest.spyOn(provider1, "perform");
        jest.spyOn(provider2, "perform");

        provider1.setWsReadyState(0);

        const res = await provider.perform("send", {});

        expect(provider1.perform).not.toHaveBeenCalled(); // Doesn't try performing since the ws never connects and we fallback
        expect(provider2.perform).toHaveBeenCalledTimes(1);
        expect(res).toEqual("2");
      });

      it("should fallback if the websocket is forever connecting, then proceed with the ws provider when the fallback fails, eventually failing", async () => {
        const provider1 = new MockWebsocketProvider("1");
        const provider2 = new FailingProvider("2");
        const provider = new FallbackProvider([provider1, provider2]);

        jest.spyOn(provider1, "perform");
        jest.spyOn(provider2, "perform");

        provider1.setWsReadyState(0);

        await expect(provider.perform("send", {})).rejects.toThrowError("timeout exceeded");

        expect(provider1.perform).toHaveBeenCalledTimes(1);
        expect(provider2.perform).toHaveBeenCalledTimes(1);
      });
    });
  });
});
