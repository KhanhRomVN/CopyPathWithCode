/**
 * FILE: src/domain/clipboard/entities/DetectedFile.ts
 * 
 * DETECTED FILE ENTITY
 * 
 * Represents a file detected from clipboard content parsing.
 */

export interface DetectedFile {
    /**
     * The file path detected from clipboard
     */
    filePath: string;

    /**
     * The content associated with this detected file
     */
    content: string;

    /**
     * Timestamp when the file was detected
     */
    detectedAt: number;
}