import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

class ResizeObserverMock {
	observe() {}

	unobserve() {}

	disconnect() {}
}

type IntersectionObserverEntryLike = {
	isIntersecting: boolean;
	target: Element;
};

class IntersectionObserverMock {
	private readonly callback: IntersectionObserverCallback;
	private readonly observed = new Set<Element>();

	constructor(callback: IntersectionObserverCallback) {
		this.callback = callback;
	}

	observe(target: Element) {
		this.observed.add(target);
	}

	unobserve(target: Element) {
		this.observed.delete(target);
	}

	disconnect() {
		this.observed.clear();
	}

	trigger(isIntersecting = true) {
		const entries: IntersectionObserverEntryLike[] = Array.from(this.observed).map((target) => ({
			isIntersecting,
			target,
		}));

		this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
	}
}

class WebSocketMock {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	readonly readyState = WebSocketMock.OPEN;
	private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

	constructor(_url: string) {
		queueMicrotask(() => {
			this.dispatchEvent(new Event("open"));
		});
	}

	addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}

		this.listeners.get(type)?.add(listener);
	}

	removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
		this.listeners.get(type)?.delete(listener);
	}

	dispatchEvent(event: Event) {
		const listeners = this.listeners.get(event.type);
		if (!listeners) {
			return true;
		}

		for (const listener of listeners) {
			if (typeof listener === "function") {
				listener.call(this, event);
			} else {
				listener.handleEvent(event);
			}
		}

		return true;
	}

	send() {}

	close() {
		this.dispatchEvent(new Event("close"));
	}
}

if (!globalThis.ResizeObserver) {
	globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
}

if (!globalThis.IntersectionObserver) {
	globalThis.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;
}

globalThis.WebSocket = WebSocketMock as unknown as typeof WebSocket;
if (typeof window !== "undefined") {
	window.WebSocket = WebSocketMock as unknown as typeof WebSocket;
}

afterEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});
