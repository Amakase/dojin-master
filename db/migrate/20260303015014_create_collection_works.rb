class CreateCollectionWorks < ActiveRecord::Migration[8.1]
  def change
    create_table :collection_works do |t|
      t.references :collection, null: false, foreign_key: true
      t.references :work, null: false, foreign_key: true
      t.text :notes

      t.timestamps
    end
  end
end
