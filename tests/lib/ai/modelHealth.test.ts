import { afterEach, describe, expect, it } from "vitest";
import {
  answerOrder,
  classifyModelError,
  healthyFirst,
  isModelCoolingDown,
  recordModelFailure,
  recordModelSuccess,
  resetModelHealth,
} from "@/lib/ai/modelHealth";

const chain = [{ modelId: "gemini" }, { modelId: "qwen" }, { modelId: "glm" }];

afterEach(() => resetModelHealth());

describe("classifyModelError", () => {
  it("tells the failures that need different cooldowns apart", () => {
    expect(
      classifyModelError(new Error("PERMISSION_DENIED: Your project has been denied access")),
    ).toBe("auth");
    expect(classifyModelError("Rate limit reached for tokens per day (TPD): Limit 200000")).toBe(
      "quota",
    );
    expect(classifyModelError("1113 Insufficient balance or no resource package")).toBe("quota");
    expect(classifyModelError("429 Too Many Requests")).toBe("rate");
    expect(classifyModelError("The model is overloaded, please try later")).toBe("overload");
    expect(classifyModelError("returned empty text")).toBe("other");
  });
});

describe("healthyFirst", () => {
  it("skips a model whose key was rejected until the cooldown ends", () => {
    const now = 1_000_000;
    recordModelFailure("gemini", "PERMISSION_DENIED", now);

    expect(healthyFirst(chain, now + 1000).map((entry) => entry.modelId)).toEqual(["qwen", "glm"]);
    expect(isModelCoolingDown("gemini", now + 31 * 60_000)).toBe(false);
  });

  it("never cools down for failures that may not repeat", () => {
    recordModelFailure("qwen", "returned empty text");
    expect(isModelCoolingDown("qwen")).toBe(false);
  });

  it("clears the cooldown after a success", () => {
    recordModelFailure("glm", "overloaded");
    recordModelSuccess("glm");
    expect(isModelCoolingDown("glm")).toBe(false);
  });

  it("still offers the model that recovers first when every model is cooling down", () => {
    const now = 5_000_000;
    recordModelFailure("gemini", "PERMISSION_DENIED", now);
    recordModelFailure("qwen", "tokens per day", now);
    recordModelFailure("glm", "429", now);

    expect(healthyFirst(chain, now + 1000).map((entry) => entry.modelId)).toEqual(["glm"]);
  });
});

describe("answerOrder", () => {
  it("keeps rate limited models at the end instead of dropping them, but skips a revoked key", () => {
    const now = 9_000_000;
    recordModelFailure("gemini", "PERMISSION_DENIED", now);
    recordModelFailure("glm", "Rate limit reached for requests", now);

    expect(answerOrder(chain, now + 1000).map((entry) => entry.modelId)).toEqual(["qwen", "glm"]);
  });

  it("still tries the soonest model when every one is out for the day", () => {
    const now = 9_500_000;
    recordModelFailure("gemini", "PERMISSION_DENIED", now);
    recordModelFailure("qwen", "tokens per day", now + 10);
    recordModelFailure("glm", "insufficient balance", now + 20);

    expect(answerOrder(chain, now + 1000).map((entry) => entry.modelId)).toEqual(["gemini"]);
  });
});
