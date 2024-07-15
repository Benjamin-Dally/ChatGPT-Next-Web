import { StabilityPath, StoreKey } from "@/app/constant";
import { showToast } from "@/app/components/ui-lib";
import { getHeaders } from "@/app/client/api";
import { createPersistStore } from "@/app/utils/store";
import { nanoid } from "nanoid";
import { saveFileData, base64Image2Blob } from "@/app/utils/file";

export const useSdStore = createPersistStore<
  {
    currentId: number;
    draw: any[];
  },
  {
    getNextId: () => number;
    sendTask: (data: any, db: any, okCall?: Function) => void;
    updateDraw: (draw: any) => void;
  }
>(
  {
    currentId: 0,
    draw: [],
  },
  (set, _get) => {
    function get() {
      return {
        ..._get(),
        ...methods,
      };
    }

    const methods = {
      getNextId() {
        const id = ++_get().currentId;
        set({ currentId: id });
        return id;
      },
      sendTask(data: any, db: any, okCall?: Function) {
        data = { ...data, id: nanoid(), status: "running" };
        set({ draw: [data, ..._get().draw] });
        // db.update(data);
        this.getNextId();
        this.stabilityRequestCall(data, db);
        okCall?.();
      },
      stabilityRequestCall(data: any, db: any) {
        const formData = new FormData();
        for (let paramsKey in data.params) {
          formData.append(paramsKey, data.params[paramsKey]);
        }
        const headers = getHeaders();
        delete headers["Content-Type"];
        fetch(`/api/stability/${StabilityPath.GeneratePath}/${data.model}`, {
          method: "POST",
          headers: {
            ...headers,
            Accept: "application/json",
          },
          body: formData,
        })
          .then((response) => response.json())
          .then((resData) => {
            if (resData.errors && resData.errors.length > 0) {
              this.updateDraw({
                ...data,
                status: "error",
                error: resData.errors[0],
              });
              this.getNextId();
              return;
            }
            if (resData.finish_reason === "SUCCESS") {
              this.updateDraw({
                ...data,
                status: "success",
                // save blob to indexeddb instead of base64 image string
                img_data: saveFileData(
                  db,
                  data.id,
                  base64Image2Blob(resData.image, "image/png"),
                ),
              });
            } else {
              this.updateDraw({
                ...data,
                status: "error",
                error: JSON.stringify(resData),
              });
            }
            this.getNextId();
          })
          .catch((error) => {
            this.updateDraw({ ...data, status: "error", error: error.message });
            console.error("Error:", error);
            this.getNextId();
          });
      },
      updateDraw(draw: any) {
        _get().draw.some((item, index) => {
          if (item.id === draw.id) {
            _get().draw[index] = draw;
            return true;
          }
        });
      },
    };

    return methods;
  },
  {
    name: StoreKey.SdList,
    version: 1.0,
  },
);
