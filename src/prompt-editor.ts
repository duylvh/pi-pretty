import type { CustomEditor } from "@earendil-works/pi-coding-agent";

/** Constructor shape used to preserve compatibility with older Pi hosts. */
export type CustomEditorConstructor = new (...args: ConstructorParameters<typeof CustomEditor>) => CustomEditor;

type PromptColor = (text: string) => string;

const PROMPT_ICON = "❯";
const PROMPT_WIDTH = 3; // one space on either side of the icon

/**
 * Build a CustomEditor subclass that reserves room for, and renders, the
 * user-message prompt. The host still owns all editing and app keybindings.
 */
export function createPromptEditorClass(
	Base: CustomEditorConstructor,
	colorPrompt: PromptColor,
): CustomEditorConstructor {
	class PromptEditor extends Base {
		private userPaddingX = 0;
		private isScrolled = false;

		constructor(...args: ConstructorParameters<CustomEditorConstructor>) {
			const [tui, theme, keybindings, options] = args;
			super(tui, theme, keybindings, { ...(options ?? {}), embedWorkingStatus: true });
			this.userPaddingX = super.getPaddingX();
			super.setPaddingX(this.userPaddingX + PROMPT_WIDTH);
		}

		override getPaddingX(): number {
			return this.userPaddingX;
		}

		override setPaddingX(padding: number): void {
			this.userPaddingX = Math.max(0, padding);
			super.setPaddingX(this.userPaddingX + PROMPT_WIDTH);
		}

		protected override renderTopBorder(width: number, hiddenLineCount: number): string {
			this.isScrolled = hiddenLineCount > 0;
			return super.renderTopBorder(width, hiddenLineCount);
		}

		override render(width: number): string[] {
			const lines = super.render(width);
			if (this.isScrolled || lines.length < 2) return lines;

			const firstContentLine = lines[1];
			if (!firstContentLine) return lines;
			const maxPadding = Math.max(0, Math.floor((width - 1) / 2));
			const promptPadding = Math.min(this.userPaddingX + PROMPT_WIDTH, maxPadding);
			if (promptPadding < PROMPT_WIDTH || !firstContentLine.startsWith(" ".repeat(promptPadding))) return lines;

			const promptStart = promptPadding - PROMPT_WIDTH;
			const prompt = ` ${colorPrompt(PROMPT_ICON)} `;
			lines[1] = `${firstContentLine.slice(0, promptStart)}${prompt}${firstContentLine.slice(promptPadding)}`;
			return lines;
		}
	}

	return PromptEditor;
}
