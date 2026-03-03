class CreateNotifications < ActiveRecord::Migration[8.1]
  def change
    create_table :notifications do |t|
      t.references :booth, null: false, foreign_key: true
      t.string :source
      t.string :content
      t.string :url
      t.boolean :read

      t.timestamps
    end
  end
end
