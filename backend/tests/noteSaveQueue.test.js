import { describe, expect, it, vi } from "vitest";
import { createNoteSaveQueue } from "../../frontend/src/lib/noteSaveQueue.js";

describe("note autosave and navigation gate", () => {
  it("does not write merely by opening a note", async () => {
    const write = vi.fn();
    const queue = createNoteSaveQueue(write);
    queue.reset({ _id: "a", content: "existing" });
    expect(await queue.flush()).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
  it("serializes edits during a slow save before allowing navigation", async () => {
    let release;
    const write = vi.fn().mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
      .mockImplementation(async value => value);
    const statuses = [], saved = [];
    const queue = createNoteSaveQueue(write, s => statuses.push(s), item => saved.push(item));
    queue.reset({ _id: "a", content: "old" });
    queue.change({ _id: "a", content: "first" });
    const navigation = queue.flush();
    queue.change({ _id: "a", content: "latest" });
    expect(queue.flush()).toBe(navigation);
    expect(statuses).not.toContain("saved");
    expect(write).toHaveBeenCalledTimes(1);
    release({ _id: "a", content: "first" });
    expect(await navigation).toBe(true);
    expect(write.mock.calls.map(([x]) => x.content)).toEqual(["first", "latest"]);
    expect(saved.at(-1).content).toBe("latest");
    expect(queue.isDirty()).toBe(false);
    queue.reset({ _id: "b", content: "second note" });
    expect(await queue.flush()).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
  });
  it("retains a failed draft, blocks closing and retries the same content", async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementation(async x => x);
    const status = vi.fn();
    const queue = createNoteSaveQueue(write, status);
    queue.reset({ _id: "a" });
    queue.change({ _id: "a", content: "do not lose", workId: null });
    expect(await queue.flush()).toBe(false);
    expect(queue.isDirty()).toBe(true);
    expect(status).toHaveBeenLastCalledWith("error");
    expect(status).not.toHaveBeenCalledWith("saved");
    expect(await queue.flush()).toBe(true);
    expect(write.mock.calls[1][0]).toEqual(write.mock.calls[0][0]);
    expect(status).toHaveBeenLastCalledWith("saved");
  });
  it("allows empty text and removal of a work link", async () => {
    const write = vi.fn(async x => x), queue = createNoteSaveQueue(write);
    queue.reset({ _id: "a", content: "text", workId: "work" });
    queue.change({ _id: "a", content: "", workId: null });
    await queue.flush();
    expect(write).toHaveBeenCalledWith({ _id: "a", content: "", workId: null });
  });
});
