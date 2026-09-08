import { afterEach, describe, expect, it, vi } from "vitest";

import piPrettyExtension from "../src/index.js";
import { createPromptEditorClass, type CustomEditorConstructor } from "../src/prompt-editor.js";

class FakeEditor {
	private padding = 1;

	constructor(..._args: unknown[]) {}

	getPaddingX(): number {
		return this.padding;
	}

	setPaddingX(padding: number): void {
		this.padding = padding;
	}

	render(_width: number): string[] {
		return ["top", `${" ".repeat(this.padding)}draft`, "bottom"];
	}
}

const fakeEditorClass = FakeEditor as unknown as CustomEditorConstructor;

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("prompt editor", () => {
	it("renders the prompt icon while preserving editor padding", () => {
		const PromptEditor = createPromptEditorClass(
			fakeEditorClass,
			(text) => `\x1b[38;5;7m${text}\x1b[39m`,
		);
		const editor = new PromptEditor(...([] as unknown as ConstructorParameters<CustomEditorConstructor>));

		expect(editor.getPaddingX()).toBe(1);
		expect(editor.render(40)[1]).toBe("  \x1b[38;5;7m❯\x1b[39m draft");
	});

	it("keeps leading spaces in the input after the reserved prompt slot", () => {
		class LeadingSpaceEditor extends FakeEditor {
			override render(_width: number): string[] {
				return ["top", `${" ".repeat(4)}   draft`, "bottom"];
			}
		}
		const PromptEditor = createPromptEditorClass(
			LeadingSpaceEditor as unknown as CustomEditorConstructor,
			(text) => `<${text}>`,
		);
		const editor = new PromptEditor(...([] as unknown as ConstructorParameters<CustomEditorConstructor>));

		expect(editor.render(40)[1]).toBe("  <❯>    draft");
	});

	it("installs the prompt editor only through the host's public editor API", async () => {
		vi.stubEnv("PRETTY_WORKING_INDICATOR", "off");
		let editorFactory: unknown;
		const handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();
		const pi = {
			registerMarkdownTransformer: () => {},
			registerFlag: () => {},
			registerTool: () => {},
			registerCommand: () => {},
			on: (name: string, handler: (event: unknown, ctx: unknown) => unknown) => handlers.set(name, handler),
		};
		const ui = {
			theme: { fg: (color: string, text: string) => `<${color}>${text}</${color}>` },
			setEditorComponent: (factory: unknown) => {
				editorFactory = factory;
			},
			getEditorComponent: () => undefined,
			setToolsExpanded: () => {},
			setWorkingVisible: () => {},
		};
		const ctx = {
			mode: "tui",
			cwd: process.cwd(),
			ui,
			sessionManager: { getSessionName: () => undefined },
		};

		await piPrettyExtension(pi as never, { sdk: {}, fffModule: undefined, customEditorClass: fakeEditorClass });
		await handlers.get("session_start")?.({}, ctx);

		expect(typeof editorFactory).toBe("function");
		const factory = editorFactory as (tui: unknown, theme: unknown, keybindings: unknown) => {
			render(width: number): string[];
		};
		const editor = factory(undefined, undefined, undefined);
		expect(editor.render(40)[1]).toContain("<thinkingText>❯</thinkingText>");

		await handlers.get("session_shutdown")?.({}, ctx);
		expect(editorFactory).toBeUndefined();
	});
});
