"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import type { ServiceAttribute } from "@/types/service-attributes";
import { LocalizedInput } from "@/components/ui/localized-input";

interface AttributeWithId extends ServiceAttribute {
  _id?: string;
}

interface AttributesManagerProps {
  readonly attributes: ServiceAttribute[];
  readonly onChange: (attributes: ServiceAttribute[]) => void;
}

export function AttributesManager({ attributes, onChange }: AttributesManagerProps) {
  const t = useTranslations("admin.attributesManager");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Add stable IDs to attributes if they don't have them (only once, not on every render)
  const attributesWithIds: AttributeWithId[] = attributes.map((attr, idx) => {
    if ((attr as AttributeWithId)._id) {
      return attr as AttributeWithId;
    }
    return {
      ...attr,
      _id: `attr-${idx}-${attr.question || "new"}`,
    };
  });

  const addAttribute = () => {
    const newAttribute: AttributeWithId = {
      question: "",
      required: true,
      type: "text",
      _id: `attr-${Date.now()}-new`,
    };
    onChange([...attributes, newAttribute]);
  };

  const updateAttribute = (index: number, updates: Partial<ServiceAttribute>) => {
    const newAttributes = [...attributes];
    newAttributes[index] = { ...newAttributes[index], ...updates };
    onChange(newAttributes);
  };

  const removeAttribute = (index: number) => {
    onChange(attributes.filter((_, i) => i !== index));
  };

  const updateOptions = (index: number, optionsText: string) => {
    // Store the raw input text in a special field to preserve user's typing including commas
    const options = optionsText
      .split(",")
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0);
    updateAttribute(index, { options, _optionsRaw: optionsText } as any);
  };

  const moveAttribute = (fromIndex: number, toIndex: number) => {
    const newAttributes = [...attributes];
    const [movedItem] = newAttributes.splice(fromIndex, 1);
    newAttributes.splice(toIndex, 0, movedItem);
    onChange(newAttributes);
  };

  const getOptionsWithCost = (attr: AttributeWithId) => {
    if (attr.optionsWithCost && attr.optionsWithCost.length > 0) return attr.optionsWithCost;
    return (attr.options || []).map((value) => ({ value, creditCost: attr.creditImpact || 0 }));
  };

  const setOptionsWithCost = (index: number, next: { value: string; creditCost?: number }[]) => {
    updateAttribute(index, {
      optionsWithCost: next,
      options: next.map((o) => o.value),
    } as any);
  };

  const addOptionRow = (index: number) => {
    const existing = getOptionsWithCost(attributes[index] as AttributeWithId);
    setOptionsWithCost(index, [...existing, { value: "", creditCost: 0 }]);
  };

  const updateOptionRow = (
    index: number,
    optionIndex: number,
    updates: { value?: string; creditCost?: number }
  ) => {
    const existing = getOptionsWithCost(attributes[index] as AttributeWithId);
    const updated = existing.map((opt, idx) =>
      idx === optionIndex ? { ...opt, ...updates } : opt
    );
    setOptionsWithCost(index, updated);
  };

  const removeOptionRow = (index: number, optionIndex: number) => {
    const existing = getOptionsWithCost(attributes[index] as AttributeWithId);
    const updated = existing.filter((_, idx) => idx !== optionIndex);
    setOptionsWithCost(index, updated);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    moveAttribute(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const moveUp = (index: number) => {
    if (index > 0) {
      moveAttribute(index, index - 1);
    }
  };

  const moveDown = (index: number) => {
    if (index < attributes.length - 1) {
      moveAttribute(index, index + 1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">{t("title")}</Label>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addAttribute}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("addQuestion")}
        </Button>
      </div>

      {attributes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("noQuestions")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {attributesWithIds.map((attr, index) => (
            <Card
              key={attr._id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`cursor-move transition-opacity ${draggedIndex === index ? "opacity-50" : ""}`}
            >
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-3 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
                      title={t("dragToReorder")}
                    >
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-4">
                      {/* Question Text (localized) */}
                      <div className="space-y-2">
                        <Label htmlFor={`question-${index}`}>
                          {t("question", { number: index + 1 })}
                        </Label>
                        <LocalizedInput
                          id={`question-${index}`}
                          placeholder={t("exampleQuestion")}
                          value={(attr as any).questionI18n ?? attr.question}
                          onChange={(next) =>
                            updateAttribute(index, {
                              questionI18n: next as any,
                              question: next.en?.trim() ? next.en : (next.ar ?? ""),
                            })
                          }
                          required
                          variant="input"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Question Type */}
                        <div className="space-y-2">
                          <Label htmlFor={`type-${index}`}>{t("answerType")}</Label>
                          <Select
                            value={attr.type}
                            onValueChange={(value) => {
                              const type = value as ServiceAttribute["type"];
                              const isChoice = type === "select" || type === "multiselect";
                              const isMedia = type === "file" || type === "voice";
                              updateAttribute(index, {
                                type,
                                options: isChoice ? attr.options || [] : undefined,
                                optionsWithCost: isChoice ? attr.optionsWithCost : undefined,
                                min: type === "number" ? attr.min : undefined,
                                max: type === "number" ? attr.max : undefined,
                                creditImpact: type === "number" ? attr.creditImpact : undefined,
                                includedQuantity:
                                  type === "number" ? attr.includedQuantity : undefined,
                                maxFiles: isMedia
                                  ? type === "voice"
                                    ? (attr.maxFiles ?? 1)
                                    : (attr.maxFiles ?? 5)
                                  : undefined,
                                maxSizeMB: isMedia
                                  ? type === "voice"
                                    ? (attr.maxSizeMB ?? 25)
                                    : (attr.maxSizeMB ?? 50)
                                  : undefined,
                              });
                            }}
                          >
                            <SelectTrigger id={`type-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">{t("text")}</SelectItem>
                              <SelectItem value="textarea">{t("textarea")}</SelectItem>
                              <SelectItem value="number">{t("number")}</SelectItem>
                              <SelectItem value="select">{t("select")}</SelectItem>
                              <SelectItem value="multiselect">{t("multiselect")}</SelectItem>
                              <SelectItem value="file">{t("file")}</SelectItem>
                              <SelectItem value="voice">{t("voice")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Required Checkbox */}
                        <div className="space-y-2">
                          <Label>{t("settings")}</Label>
                          <div className="flex items-center gap-2 pt-2">
                            <Checkbox
                              id={`required-${index}`}
                              checked={attr.required}
                              onCheckedChange={(checked) =>
                                updateAttribute(index, { required: checked as boolean })
                              }
                            />
                            <label
                              htmlFor={`required-${index}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {t("required")}
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Options for Select/Multiselect with per-option credit cost */}
                      {(attr.type === "select" || attr.type === "multiselect") && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>{t("options")}</Label>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-1"
                              onClick={() => addOptionRow(index)}
                            >
                              <Plus className="h-4 w-4" />
                              {t("addQuestion")}
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {getOptionsWithCost(attr).map((opt, optIdx) => (
                              <div
                                key={`${attr._id}-opt-${optIdx}`}
                                className="grid grid-cols-1 md:grid-cols-[1fr_140px_40px] items-center gap-2"
                              >
                                <Input
                                  value={opt.value}
                                  placeholder={t("exampleOptions")}
                                  onChange={(e) =>
                                    updateOptionRow(index, optIdx, { value: e.target.value })
                                  }
                                />
                                <Input
                                  type="number"
                                  value={opt.creditCost ?? ""}
                                  placeholder="0"
                                  onChange={(e) =>
                                    updateOptionRow(index, optIdx, {
                                      creditCost:
                                        e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => removeOptionRow(index, optIdx)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            {getOptionsWithCost(attr).length === 0 && (
                              <p className="text-xs text-muted-foreground">{t("noQuestions")}</p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t("optionsCount", { count: getOptionsWithCost(attr).length })}
                          </p>
                        </div>
                      )}

                      {/* Min/Max for Number Type */}
                      {attr.type === "number" && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`min-${index}`}>
                              {t("minValue")}{" "}
                              <span className="text-muted-foreground">({t("optional")})</span>
                            </Label>
                            <Input
                              id={`min-${index}`}
                              type="number"
                              placeholder="e.g., 1"
                              value={attr.min ?? ""}
                              onChange={(e) =>
                                updateAttribute(index, {
                                  min: e.target.value ? Number(e.target.value) : undefined,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`max-${index}`}>
                              {t("maxValue")}{" "}
                              <span className="text-muted-foreground">({t("optional")})</span>
                            </Label>
                            <Input
                              id={`max-${index}`}
                              type="number"
                              placeholder="e.g., 100"
                              value={attr.max ?? ""}
                              onChange={(e) =>
                                updateAttribute(index, {
                                  max: e.target.value ? Number(e.target.value) : undefined,
                                })
                              }
                            />
                          </div>
                        </div>
                      )}

                      {/* File / voice upload limits */}
                      {(attr.type === "file" || attr.type === "voice") && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`maxFiles-${index}`}>{t("maxFiles")}</Label>
                            <Input
                              id={`maxFiles-${index}`}
                              type="number"
                              min={1}
                              max={10}
                              value={attr.maxFiles ?? (attr.type === "voice" ? 1 : 5)}
                              onChange={(e) => {
                                const n = e.target.value ? Number(e.target.value) : undefined;
                                updateAttribute(index, {
                                  maxFiles:
                                    n === undefined ? undefined : Math.min(10, Math.max(1, n)),
                                });
                              }}
                            />
                            <p className="text-xs text-muted-foreground">{t("maxFilesHelp")}</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`maxSizeMB-${index}`}>{t("maxSizeMB")}</Label>
                            <Input
                              id={`maxSizeMB-${index}`}
                              type="number"
                              min={1}
                              value={attr.maxSizeMB ?? (attr.type === "voice" ? 25 : 50)}
                              onChange={(e) =>
                                updateAttribute(index, {
                                  maxSizeMB: e.target.value
                                    ? Math.max(1, Number(e.target.value))
                                    : undefined,
                                })
                              }
                            />
                            <p className="text-xs text-muted-foreground">{t("maxSizeMBHelp")}</p>
                          </div>
                        </div>
                      )}

                      {/* Credit Impact (for number type only) */}
                      {attr.type === "number" && (
                        <div className="space-y-2">
                          <Label htmlFor={`creditImpact-${index}`}>
                            {t("creditImpact")}{" "}
                            <span className="text-muted-foreground">({t("optional")})</span>
                          </Label>
                          <Input
                            id={`creditImpact-${index}`}
                            type="number"
                            placeholder="e.g., 5"
                            value={attr.creditImpact ?? ""}
                            onChange={(e) =>
                              updateAttribute(index, {
                                creditImpact: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                          />
                          <p className="text-xs text-muted-foreground">{t("creditImpactHelp")}</p>
                        </div>
                      )}

                      {/* Included Quantity (for number type only) */}
                      {attr.type === "number" && attr.creditImpact && (
                        <div className="space-y-2">
                          <Label htmlFor={`includedQuantity-${index}`}>
                            {t("includedQuantity")}{" "}
                            <span className="text-muted-foreground">({t("optional")})</span>
                          </Label>
                          <Input
                            id={`includedQuantity-${index}`}
                            type="number"
                            placeholder="e.g., 20"
                            value={attr.includedQuantity ?? ""}
                            onChange={(e) =>
                              updateAttribute(index, {
                                includedQuantity: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              })
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("includedQuantityHelp")}
                          </p>
                        </div>
                      )}

                      {/* Placeholder (optional, localized) */}
                      <div className="space-y-2">
                        <Label htmlFor={`placeholder-${index}`}>
                          {t("placeholderOptional")}{" "}
                          <span className="text-muted-foreground">({t("optional")})</span>
                        </Label>
                        <LocalizedInput
                          id={`placeholder-${index}`}
                          placeholder={t("examplePlaceholder")}
                          value={(attr as any).placeholderI18n ?? attr.placeholder ?? ""}
                          onChange={(next) =>
                            updateAttribute(index, {
                              placeholderI18n: next as any,
                              placeholder: next.en?.trim() ? next.en : (next.ar ?? ""),
                            })
                          }
                          variant="input"
                        />
                      </div>

                      {/* Help Text (optional, localized) */}
                      <div className="space-y-2">
                        <Label htmlFor={`helptext-${index}`}>
                          {t("helpTextOptional")}{" "}
                          <span className="text-muted-foreground">({t("optional")})</span>
                        </Label>
                        <LocalizedInput
                          id={`helptext-${index}`}
                          placeholder={t("helpTextDescription")}
                          value={(attr as any).helpTextI18n ?? attr.helpText ?? ""}
                          onChange={(next) =>
                            updateAttribute(index, {
                              helpTextI18n: next as any,
                              helpText: next.en?.trim() ? next.en : (next.ar ?? ""),
                            })
                          }
                          variant="textarea"
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-1 mt-2">
                      {/* Move Up */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={index === 0}
                        onClick={() => moveUp(index)}
                        title={t("moveUp")}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>

                      {/* Move Down */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={index === attributes.length - 1}
                        onClick={() => moveDown(index)}
                        title={t("moveDown")}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>

                      {/* Delete */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeAttribute(index)}
                        title={t("deleteQuestion")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
