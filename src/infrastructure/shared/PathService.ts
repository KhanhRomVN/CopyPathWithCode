import * as path from 'path';
import { IPathService } from '../../domain/folder/services/TreeService';

export class NodePathService implements IPathService {

    normalize(filePath: string): string {
        return path.normalize(filePath).replace(/\\/g, '/');
    }

    join(...paths: string[]): string {
        return path.join(...paths).replace(/\\/g, '/');
    }

    dirname(filePath: string): string {
        return path.dirname(filePath).replace(/\\/g, '/');
    }

    basename(filePath: string): string {
        return path.basename(filePath);
    }

    extname(filePath: string): string {
        return path.extname(filePath);
    }

    relative(from: string, to: string): string {
        return path.relative(from, to).replace(/\\/g, '/');
    }

    isAbsolute(filePath: string): boolean {
        return path.isAbsolute(filePath);
    }
}