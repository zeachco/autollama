import fs from "fs";
// Function to handle streaming and writing to a file
export function streamToFile(filePath: string) {
  const file = fs.createWriteStream(filePath);
  const encoder = new TextEncoder();

  return async function addChunk(chunk: string): Promise<void> {
    return new Promise((resolve, reject) => {
      file.write(encoder.encode(chunk), (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };
}

/**
 * example usage
 * ```ts

 const addChunk = streamToFile('output.txt');
 await addChunk('Hello');
 await addChunk(' ');
 await addChunk('World');
 await addChunk('!\n');
 await addChunk('Hello');
 await addChunk(' ');
 await addChunk('World');
 await addChunk('!\n');
 * ``
 */
