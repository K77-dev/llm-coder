import { EventEmitter } from 'events';
import { LlamaServerManager, LlamaServerState, ServerStatus } from '../../../electron/llama-server-manager';

// Mock child_process
const mockSpawn = jest.fn();
const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Mock fs
const mockExistsSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockStatSync = jest.fn();
jest.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
}));

// Mock http
const mockHttpGet = jest.fn();
jest.mock('http', () => ({
  get: (...args: unknown[]) => mockHttpGet(...args),
}));

function createMockProcess(): EventEmitter & {
  pid: number;
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: jest.Mock;
} {
  const proc = new EventEmitter() as EventEmitter & {
    pid: number;
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: jest.Mock;
  };
  proc.pid = 12345;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn();
  return proc;
}

function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function createManager(port = 9999) {
  const logger = createMockLogger();
  const manager = new LlamaServerManager({
    logger,
    execPath: '/usr/local/bin/llama-server',
    port,
  });
  return { manager, logger };
}

function mockHealthCheckSuccess() {
  mockHttpGet.mockImplementation((_url: string, cb: (res: { statusCode: number; resume: () => void }) => void) => {
    const res = { statusCode: 200, resume: jest.fn() };
    cb(res);
    return { on: jest.fn(), setTimeout: jest.fn() };
  });
}

function mockHealthCheckFailThenSuccess(failCount: number) {
  let calls = 0;
  mockHttpGet.mockImplementation((_url: string, cb: (res: { statusCode: number; resume: () => void }) => void) => {
    calls++;
    if (calls <= failCount) {
      return {
        on: (_event: string, handler: () => void) => { handler(); },
        setTimeout: jest.fn(),
      };
    }
    const res = { statusCode: 200, resume: jest.fn() };
    cb(res);
    return { on: jest.fn(), setTimeout: jest.fn() };
  });
}

describe('LlamaServerManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockExecSync.mockImplementation(() => { throw new Error('no process'); });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('should start with stopped status', () => {
      const { manager } = createManager();
      const state = manager.getState();
      expect(state.status).toBe('stopped');
      expect(state.activeModel).toBeNull();
      expect(state.pid).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('start()', () => {
    it('should spawn process and transition to starting then running', async () => {
      const { manager } = createManager();
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);
      mockHealthCheckSuccess();
      const states: ServerStatus[] = [];
      manager.onStateChange((s: LlamaServerState) => states.push(s.status));
      const startPromise = manager.start('/models/test.gguf');
      await startPromise;
      expect(mockSpawn).toHaveBeenCalledWith(
        '/usr/local/bin/llama-server',
        ['-m', '/models/test.gguf', '--port', '9999', '--embeddings', '--pooling', 'mean', '-c', String(8192), '--ubatch-size', String(8192), '--batch-size', String(8192)],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      expect(states).toContain('starting');
      expect(states).toContain('running');
      expect(manager.getState().status).toBe('running');
      expect(manager.getState().activeModel).toBe('test.gguf');
      expect(manager.getState().pid).toBe(12345);
    });

    it('should transition to error when spawn emits error', async () => {
      const { manager } = createManager();
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);
      const states: ServerStatus[] = [];
      manager.onStateChange((s: LlamaServerState) => states.push(s.status));
      // Make health check hang, then trigger process error
      mockHttpGet.mockImplementation(() => {
        // Simulate process error on next tick
        setTimeout(() => {
          mockProc.emit('error', new Error('spawn ENOENT'));
        }, 0);
        return {
          on: (_event: string, handler: () => void) => { handler(); },
          setTimeout: jest.fn(),
        };
      });
      const startPromise = manager.start('/models/test.gguf');
      // Advance timers to allow health check retries and error propagation
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      jest.advanceTimersByTime(61_000);
      await Promise.resolve();
      try {
        await startPromise;
      } catch {
        // Expected to fail
      }
      expect(manager.getState().status).toBe('error');
      expect(manager.getState().error).toBeTruthy();
    });

    it('should transition to error when executable is not found', async () => {
      const { manager } = createManager();
      const mockProc = createMockProcess();
      // Spawn returns process, then we trigger error after handlers are attached
      mockSpawn.mockImplementation(() => {
        // Schedule error emission after current microtask (handlers will be attached)
        Promise.resolve().then(() => {
          mockProc.emit('error', new Error('spawn ENOENT'));
        });
        return mockProc;
      });
      mockHttpGet.mockImplementation(() => {
        return {
          on: (_event: string, handler: () => void) => { handler(); },
          setTimeout: jest.fn(),
        };
      });
      const startPromise = manager.start('/models/test.gguf');
      // Let the microtask (error emission) run
      await Promise.resolve();
      await Promise.resolve();
      // Advance timers for health check retry
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      jest.advanceTimersByTime(61_000);
      try {
        await startPromise;
      } catch {
        // Expected
      }
      expect(manager.getState().status).toBe('error');
    });
  });

  describe('stop()', () => {
    it('should send SIGTERM and transition to stopped', async () => {
      const { manager } = createManager();
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);
      mockHealthCheckSuccess();
      await manager.start('/models/test.gguf');
      // Make kill trigger exit event
      mockProc.kill.mockImplementation((signal: string) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => mockProc.emit('exit', 0), 100);
        }
      });
      const stopPromise = manager.stop();
      jest.advanceTimersByTime(200);
      await stopPromise;
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
      expect(manager.getState().status).toBe('stopped');
      expect(manager.getState().activeModel).toBeNull();
    });

    it('should use SIGKILL after 5s timeout', async () => {
      const { manager } = createManager();
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);
      mockHealthCheckSuccess();
      await manager.start('/models/test.gguf');
      // Kill does NOT trigger exit (process hangs)
      mockProc.kill.mockImplementation(() => {});
      const stopPromise = manager.stop();
      // Advance past the 5s graceful shutdown timeout
      jest.advanceTimersByTime(6000);
      await stopPromise;
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockProc.kill).toHaveBeenCalledWith('SIGKILL');
      expect(manager.getState().status).toBe('stopped');
    });

    it('should handle stop when no process is running', async () => {
      const { manager } = createManager();
      await manager.stop();
      expect(manager.getState().status).toBe('stopped');
    });
  });

  describe('restart()', () => {
    it('should stop then start with new model', async () => {
      const { manager } = createManager();
      const mockProc1 = createMockProcess();
      const mockProc2 = createMockProcess();
      mockProc2.pid = 67890;
      let spawnCount = 0;
      mockSpawn.mockImplementation(() => {
        spawnCount++;
        return spawnCount === 1 ? mockProc1 : mockProc2;
      });
      mockHealthCheckSuccess();
      await manager.start('/models/model-a.gguf');
      expect(manager.getState().activeModel).toBe('model-a.gguf');
      // Make stop work
      mockProc1.kill.mockImplementation((signal: string) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => mockProc1.emit('exit', 0), 50);
        }
      });
      const restartPromise = manager.restart('/models/model-b.gguf');
      jest.advanceTimersByTime(100);
      await restartPromise;
      expect(manager.getState().status).toBe('running');
      expect(manager.getState().activeModel).toBe('model-b.gguf');
      expect(manager.getState().pid).toBe(67890);
    });

    it('should accept port as dynamic config parameter', async () => {
      const { manager } = createManager(9999);
      const mockProc1 = createMockProcess();
      const mockProc2 = createMockProcess();
      mockProc2.pid = 67890;
      let spawnCount = 0;
      mockSpawn.mockImplementation(() => {
        spawnCount++;
        return spawnCount === 1 ? mockProc1 : mockProc2;
      });
      mockHealthCheckSuccess();
      await manager.start('/models/model-a.gguf');
      expect(manager.getState().port).toBe(9999);
      mockProc1.kill.mockImplementation((signal: string) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => mockProc1.emit('exit', 0), 50);
        }
      });
      const restartPromise = manager.restart('/models/model-a.gguf', { port: 7777 });
      jest.advanceTimersByTime(100);
      await restartPromise;
      expect(manager.getState().port).toBe(7777);
      expect(mockSpawn).toHaveBeenLastCalledWith(
        '/usr/local/bin/llama-server',
        ['-m', '/models/model-a.gguf', '--port', '7777', '--embeddings', '--pooling', 'mean', '-c', String(8192), '--ubatch-size', String(8192), '--batch-size', String(8192)],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
    });

    it('should accept execPath as dynamic config parameter', async () => {
      const { manager } = createManager();
      const mockProc1 = createMockProcess();
      const mockProc2 = createMockProcess();
      let spawnCount = 0;
      mockSpawn.mockImplementation(() => {
        spawnCount++;
        return spawnCount === 1 ? mockProc1 : mockProc2;
      });
      mockHealthCheckSuccess();
      await manager.start('/models/model-a.gguf');
      mockProc1.kill.mockImplementation((signal: string) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => mockProc1.emit('exit', 0), 50);
        }
      });
      const restartPromise = manager.restart('/models/model-a.gguf', { execPath: '/new/path/llama-server' });
      jest.advanceTimersByTime(100);
      await restartPromise;
      expect(mockSpawn).toHaveBeenLastCalledWith(
        '/new/path/llama-server',
        ['-m', '/models/model-a.gguf', '--port', '9999', '--embeddings', '--pooling', 'mean', '-c', String(8192), '--ubatch-size', String(8192), '--batch-size', String(8192)],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
    });

    it('should accept both port and execPath as dynamic config', async () => {
      const { manager } = createManager(9999);
      const mockProc1 = createMockProcess();
      const mockProc2 = createMockProcess();
      let spawnCount = 0;
      mockSpawn.mockImplementation(() => {
        spawnCount++;
        return spawnCount === 1 ? mockProc1 : mockProc2;
      });
      mockHealthCheckSuccess();
      await manager.start('/models/model-a.gguf');
      mockProc1.kill.mockImplementation((signal: string) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => mockProc1.emit('exit', 0), 50);
        }
      });
      const restartPromise = manager.restart('/models/model-a.gguf', { port: 5555, execPath: '/custom/llama' });
      jest.advanceTimersByTime(100);
      await restartPromise;
      expect(manager.getState().port).toBe(5555);
      expect(mockSpawn).toHaveBeenLastCalledWith(
        '/custom/llama',
        ['-m', '/models/model-a.gguf', '--port', '5555', '--embeddings', '--pooling', 'mean', '-c', String(8192), '--ubatch-size', String(8192), '--batch-size', String(8192)],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
    });
  });

  describe('activeModel stores filename only (BUG-01 regression)', () => {
    it('should store only the filename in activeModel, not the full path', async () => {
      const { manager } = createManager();
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);
      mockHealthCheckSuccess();
      await manager.start('/Users/kelsen/models/llama-7b.gguf');
      expect(manager.getState().activeModel).toBe('llama-7b.gguf');
      expect(manager.getState().activeModel).not.toContain('/');
    });

    it('should allow ModelSelector comparison with fileName after start', async () => {
      const { manager } = createManager();
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);
      mockHealthCheckSuccess();
      await manager.start('/Users/kelsen/models/codellama-13b.gguf');
      const modelFileName = 'codellama-13b.gguf';
      expect(manager.getState().activeModel).toBe(modelFileName);
    });
  });

  describe('scanModels()', () => {
    it('should list .gguf files with metadata', () => {
      const { manager } = createManager();
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'llama-7b.gguf',
        'mistral-7b.gguf',
        'readme.txt',
      ]);
      mockStatSync.mockImplementation((filePath: string) => {
        if (filePath.includes('llama-7b')) {
          return { isFile: () => true, size: 4_000_000_000 };
        }
        if (filePath.includes('mistral-7b')) {
          return { isFile: () => true, size: 5_000_000_000 };
        }
        return { isFile: () => true, size: 100 };
      });
      const models = manager.scanModels('/models');
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        fileName: 'llama-7b.gguf',
        displayName: 'llama-7b',
        sizeBytes: 4_000_000_000,
        path: '/models/llama-7b.gguf',
      });
      expect(models[1]).toEqual({
        fileName: 'mistral-7b.gguf',
        displayName: 'mistral-7b',
        sizeBytes: 5_000_000_000,
        path: '/models/mistral-7b.gguf',
      });
    });

    it('should return empty array for non-existent directory', () => {
      const { manager } = createManager();
      mockExistsSync.mockReturnValue(false);
      const models = manager.scanModels('/non-existent');
      expect(models).toEqual([]);
    });

    it('should ignore non-.gguf files', () => {
      const { manager } = createManager();
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'model.bin',
        'readme.md',
        'config.json',
        'model.safetensors',
      ]);
      const models = manager.scanModels('/models');
      expect(models).toEqual([]);
    });

    it('should return empty array for empty directory', () => {
      const { manager } = createManager();
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([]);
      const models = manager.scanModels('/models');
      expect(models).toEqual([]);
    });

    it('should skip files with inaccessible stats', () => {
      const { manager } = createManager();
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['good.gguf', 'bad.gguf']);
      mockStatSync.mockImplementation((filePath: string) => {
        if (filePath.includes('bad')) {
          throw new Error('Permission denied');
        }
        return { isFile: () => true, size: 1_000_000 };
      });
      const models = manager.scanModels('/models');
      expect(models).toHaveLength(1);
      expect(models[0].fileName).toBe('good.gguf');
    });
  });

  describe('onStateChange', () => {
    it('should emit state changes to all listeners', async () => {
      const { manager } = createManager();
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);
      mockHealthCheckSuccess();
      const listener1: LlamaServerState[] = [];
      const listener2: LlamaServerState[] = [];
      manager.onStateChange((s) => listener1.push(s));
      manager.onStateChange((s) => listener2.push(s));
      await manager.start('/models/test.gguf');
      expect(listener1.length).toBeGreaterThan(0);
      expect(listener2.length).toBeGreaterThan(0);
      expect(listener1.length).toBe(listener2.length);
      // Both listeners should receive the same states
      for (let i = 0; i < listener1.length; i++) {
        expect(listener1[i].status).toBe(listener2[i].status);
      }
    });

    it('should emit starting and running states during successful start', async () => {
      const { manager } = createManager();
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);
      mockHealthCheckSuccess();
      const statuses: ServerStatus[] = [];
      manager.onStateChange((s) => statuses.push(s.status));
      await manager.start('/models/test.gguf');
      expect(statuses[0]).toBe('starting');
      expect(statuses[statuses.length - 1]).toBe('running');
    });

    it('should return unsubscribe function that removes listener', async () => {
      const { manager } = createManager();
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);
      mockHealthCheckSuccess();
      const states: LlamaServerState[] = [];
      const unsubscribe = manager.onStateChange((s) => states.push(s));
      await manager.start('/models/test.gguf');
      const statesBeforeUnsub = states.length;
      expect(statesBeforeUnsub).toBeGreaterThan(0);
      unsubscribe();
      // Stop should not trigger any more callbacks
      mockProc.kill.mockImplementation((signal: string) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => mockProc.emit('exit', 0), 50);
        }
      });
      const stopPromise = manager.stop();
      jest.advanceTimersByTime(100);
      await stopPromise;
      expect(states.length).toBe(statesBeforeUnsub);
    });

    it('should handle calling unsubscribe multiple times safely', () => {
      const { manager } = createManager();
      const cb = jest.fn();
      const unsubscribe = manager.onStateChange(cb);
      unsubscribe();
      unsubscribe(); // should not throw
    });

    it('should emit stopped state during stop', async () => {
      const { manager } = createManager();
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);
      mockHealthCheckSuccess();
      await manager.start('/models/test.gguf');
      mockProc.kill.mockImplementation((signal: string) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => mockProc.emit('exit', 0), 50);
        }
      });
      const statuses: ServerStatus[] = [];
      manager.onStateChange((s) => statuses.push(s.status));
      const stopPromise = manager.stop();
      jest.advanceTimersByTime(100);
      await stopPromise;
      expect(statuses).toContain('stopped');
    });
  });
});
